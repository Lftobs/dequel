import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isMap, isScalar, isSeq, parseDocument } from "yaml";
import { type ComposeVolumeMount, syncComposeStackVolumes } from "../db/repo/volumes";
import { config } from "../utils/config";
import { dockerBin } from "../utils/docker-bin";
import { buildCaddySnippet } from "../utils/domain-verifier";
import {
	deployWithCompose,
	destroyComposeStack,
	deployWithCompose,
	destroyComposeStack,
	evaluateComposeContainerState,
	fetchContainerExitLogs,
	findComposeFilePath,
	getComposeContainerNames,
	inspectComposeContainerStates,
	parseAllComposeServices,
} from "./compose";
import { buildComposeScopedOverrideYaml, type ComposeEnvRow } from "./compose-env";
import { parseComposeBuildServices } from "./compose-vars";
import { reloadCaddy, tryRun } from "./runtime";

export interface ComposeDeployResult {
	containerName: string;
	liveUrl: string;
}

const VERIFY_ATTEMPTS = 6;
const VERIFY_INTERVAL_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const verifyComposeStackAfterUp = async (
	serviceContainers: Map<string, string>,
	primaryService: string,
	onLog: (line: string) => Promise<void>,
	signal?: AbortSignal,
): Promise<void> => {
	if (signal?.throwIfAborted?.()) throw new Error("Deploy aborted");
	const names = [...serviceContainers.values()];
	const sawRunning = new Set<string>();

	await onLog(`Waiting for ${names.length} compose service(s) to reach running state...`);

	for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++) {
		signal?.throwIfAborted?.();
		const states = await inspectComposeContainerStates(names);
		let okCount = 0;
		for (const [service, container] of serviceContainers) {
			const status = states.get(container) ?? null;
			const verdict = evaluateComposeContainerState(container, status, {
				primary: service === primaryService,
				everSawRunning: sawRunning.has(service),
			});
			if (status === "running") sawRunning.add(service);
			if (verdict.kind === "ok") {
				okCount++;
				continue;
			}
			if (verdict.kind === "fatal") {
				const logs = await fetchContainerExitLogs(container);
				await onLog(`Service verification failed: ${verdict.reason}. Last logs:\n${logs}`);
				throw new Error(`Compose service ${verdict.reason}`);
			}
			await onLog(`Service ${service} ${verdict.reason} (attempt ${attempt}/${VERIFY_ATTEMPTS})`);
		}
		if (okCount === serviceContainers.size) {
			await onLog("Compose services verified: all containers running.");
			return;
		}
		await sleep(VERIFY_INTERVAL_MS);
	}

	const states = await inspectComposeContainerStates(names);
	const primaryContainer = serviceContainers.get(primaryService) ?? primaryService;
	const primaryStatus = states.get(primaryContainer) ?? null;
	if (primaryStatus !== "running") {
		const logs = await fetchContainerExitLogs(primaryContainer);
		await onLog(`Primary service did not reach running state. Last logs:\n${logs}`);
		throw new Error(
			`Primary compose service ${primaryContainer} is ${primaryStatus ?? "missing"} after ${VERIFY_ATTEMPTS} attempts`,
		);
	}
	for (const [service, container] of serviceContainers) {
		const st = states.get(container) ?? null;
		if (st !== "running" && service !== primaryService) {
			await onLog(
				`Warning: service ${service} (${container}) is "${st}" after ${VERIFY_ATTEMPTS} attempts; continuing`,
			);
		}
	}
	await onLog("Compose services verified: primary container running.");
};

export const stableVolumeName = (projectId: string, volumeKey: string): string => {
	const idPart = projectId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
	const keyPart = volumeKey.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 60);
	return `dq-${idPart}-${keyPart}`;
};

const VOLUME_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

export const rewriteVolumesForProject = async (
	composeFile: string,
	projectId: string,
): Promise<ComposeVolumeMount[]> => {
	const content = await readFile(composeFile, "utf8");
	const doc = parseDocument(content);
	if (doc.errors.length > 0) return [];

	const volumes = doc.get("volumes");
	if (!isMap(volumes)) return [];

	const renames = new Map<string, string>();
	for (const item of volumes.items) {
		const key = isScalar(item.key) && typeof item.key.value === "string" ? item.key.value : "";
		if (!VOLUME_KEY_RE.test(key)) continue;
		if (isMap(item.value)) {
			const external = item.value.get("external");
			if (external === true || (typeof external === "string" && external.length > 0)) continue;
			if (item.value.get("name") === undefined || item.value.get("name") === null) {
				item.value.set("name", stableVolumeName(projectId, key));
			}
		} else if (
			item.value === null ||
			item.value === undefined ||
			(isScalar(item.value) && (item.value.value === null || item.value.value === undefined))
		) {
			volumes.set(key, doc.createNode({ name: stableVolumeName(projectId, key) }));
		}
		renames.set(key, stableVolumeName(projectId, key));
	}
	if (renames.size === 0) return [];

	const services = doc.get("services");
	const mounts: ComposeVolumeMount[] = [];
	if (isMap(services)) {
		for (const serviceItem of services.items) {
			if (!isMap(serviceItem.value)) continue;
			const serviceVolumes = serviceItem.value.get("volumes");
			if (!isSeq(serviceVolumes)) continue;
			for (const vol of serviceVolumes.items) {
				if (isScalar(vol) && typeof vol.value === "string") {
					const m = vol.value.match(/^([A-Za-z0-9][A-Za-z0-9_.-]*):(.*)$/);
					if (m && renames.has(m[1])) {
						const stable = renames.get(m[1])!;
						vol.value = `${stable}:${m[2]}`;
						mounts.push({ volumeKey: stable, containerPath: m[2] });
					}
				} else if (isMap(vol)) {
					const source = vol.get("source");
					if (isScalar(source) && typeof source.value === "string" && renames.has(source.value)) {
						const stable = renames.get(source.value)!;
						vol.set("source", stable);
						const target = vol.get("target");
						mounts.push({
							volumeKey: stable,
							containerPath: isScalar(target) && typeof target.value === "string" ? target.value : "",
						});
					}
				}
			}
		}
	}

	for (const item of volumes.items) {
		if (isScalar(item.key) && typeof item.key.value === "string" && renames.has(item.key.value)) {
			item.key.value = renames.get(item.key.value)!;
		}
	}

	await writeFile(composeFile, doc.toString(), "utf8");
	return mounts;
};

export interface ComposeDeployOptions {
	workspacePath: string;
	deploymentId: string;
	projectId: string;
	projectName: string;
	sourceDir?: string | null;
	composeService?: string | null;
	composePort?: number | null;
	composeServicesJson?: string | null;
	oldDeploymentId?: string | null;
	envVars?: Record<string, string>;
	envVarRows?: ComposeEnvRow[];
	signal?: AbortSignal;
	onLog: (line: string) => Promise<void>;
}

export const deployComposeStack = async (options: ComposeDeployOptions): Promise<ComposeDeployResult> => {
	const {
		workspacePath,
		deploymentId,
		projectId,
		projectName,
		sourceDir,
		composeService,
		composePort,
		composeServicesJson,
		oldDeploymentId,
		envVars,
		envVarRows,
		signal,
		onLog,
	} = options;

	if (oldDeploymentId) {
		await onLog(
			`Blue-green deploy: keeping previous stack deploy-${oldDeploymentId} running until the new stack passes verification`,
		);
	}

	const composeFile = findComposeFilePath(workspacePath, sourceDir);
	if (composeFile) {
		const mounts = await rewriteVolumesForProject(composeFile, projectId);
		await syncComposeStackVolumes(projectId, mounts);
	}

	const allServices = parseAllComposeServices(workspacePath, sourceDir, composeService, composePort);

	let overridePath: string | null = null;
	const rows = envVarRows ?? (envVars ? Object.entries(envVars).map(([key, value]) => ({ key, value })) : []);
	if (rows.length > 0) {
		const composeFile = findComposeFilePath(workspacePath, sourceDir);
		const buildServices = composeFile ? await parseComposeBuildServices(composeFile) : [];
		const overrideYaml = buildComposeScopedOverrideYaml(
			allServices.map((s) => s.serviceName),
			buildServices,
			rows,
		);
		if (overrideYaml) {
			overridePath = join(workspacePath, "dequel-env-override.yml");
			await writeFile(overridePath, overrideYaml);
			const runtimeCount = rows.filter((r) => r.scope !== "build").length;
			const buildCount = rows.filter((r) => r.scope !== "runtime").length;
			await onLog(
				`Injecting ${runtimeCount} runtime env var(s) into ${allServices.length} service(s) and ${buildCount} build arg(s) into ${buildServices.length} buildable service(s) via override file.`,
			);
		}
	}

	await deployWithCompose(workspacePath, `deploy-${deploymentId}`, onLog, sourceDir, envVars, signal, overridePath);

	const composeContainers = await getComposeContainerNames(`deploy-${deploymentId}`);
	const containerFor = (serviceName: string) =>
		composeContainers.get(serviceName) || `deploy-${deploymentId}-${serviceName}-1`;

	const target = allServices.find((s) => s.isPrimary) || allServices[0];
	const verifyTargets = new Map(allServices.map((s) => [s.serviceName, containerFor(s.serviceName)]));
	await verifyComposeStackAfterUp(verifyTargets, target.serviceName, onLog, signal);

	for (const s of allServices) {
		const cName = containerFor(s.serviceName);
		await tryRun(dockerBin, ["network", "connect", config.dockerNetwork, cName]);
	}

	const containerName = containerFor(target.serviceName);

	const slug = projectName
		? projectName
				.toLowerCase()
				.replace(/[^a-z0-9-]+/g, "-")
				.replace(/^-+|-+$/g, "")
				.slice(0, 63)
		: projectId;

	let snippet = await buildCaddySnippet(slug, containerName, projectId, undefined, target.port);

	const rawBaseDomain = config.caddyBaseDomain || "localhost";
	const baseDomainForCaddy = rawBaseDomain === "localhost" ? `${rawBaseDomain}:80` : rawBaseDomain;
	let customMappings: { serviceName: string; port: number | string; subdomain?: string }[] = [];
	if (composeServicesJson) {
		try {
			customMappings = JSON.parse(composeServicesJson);
		} catch (_e) {}
	}

	for (const s of allServices) {
		if (s.isPrimary) continue;
		const sContainer = containerFor(s.serviceName);
		const customMatch = customMappings.find((c) => c.serviceName === s.serviceName);
		const domains: string[] = [];
		if (customMatch?.subdomain?.trim()) {
			domains.push(`${customMatch.subdomain.trim()}.${slug}.${baseDomainForCaddy}`);
		} else {
			domains.push(`${s.serviceName}.${slug}.${baseDomainForCaddy}`);
			if (s.serviceName === "server" && !domains.includes(`api.${slug}.${baseDomainForCaddy}`)) {
				domains.push(`api.${slug}.${baseDomainForCaddy}`);
			}
		}
		const targetPort = customMatch?.port ? Number(customMatch.port) : s.port;
		snippet += `\n${domains.join(", ")} {\n  log {\n    output stdout\n    format json\n  }\n  reverse_proxy ${sContainer}:${targetPort}\n}\n`;
	}

	const caddyRouteFile = join(config.caddyRoutesDir, `${slug}.caddy`);
	await writeFile(caddyRouteFile, snippet, "utf8");
	try {
		await reloadCaddy();
	} catch {
		console.warn("[Pipeline] Caddy not ready for reload after compose deploy");
	}

	if (oldDeploymentId) {
		await onLog(`New stack verified and routed; tearing down previous stack deploy-${oldDeploymentId}`);
		await destroyComposeStack(`deploy-${oldDeploymentId}`).catch((e) =>
			onLog(`Warning: failed to tear down previous stack deploy-${oldDeploymentId}: ${e?.message ?? e}`),
		);
	}

	const liveUrl = rawBaseDomain === "localhost" ? `http://${slug}.localhost` : `https://${slug}.${rawBaseDomain}`;

	return { containerName, liveUrl };
};
