import { readFileSync } from "node:fs";
import { join } from "node:path";
import { remoteScriptFailure, summarizeDeploymentError } from "../orchestrator/deployment-errors";
import type { Deployment, Project, Server } from "../types";
import { config } from "../utils/config";
import { CANCELLED_FAILURE_REASON } from "../utils/failure-outcome";
import { RemoteScriptAbortedError, removeRemoteCaddyRoute, runRemoteScript, syncRemoteCaddyRoute } from "../utils/ssh";
import { emitLog } from "./logging";
import { buildRemoteDeployScript, parseRemoteBuildResult } from "./ssh-build-script";
import {
	buildRemoteComposeDestroyScript,
	buildRemoteComposeScript,
	parseRemoteComposeResult,
} from "./ssh-compose-script";
import type { DeploymentExecutor, ExecutorCancelInput, ExecutorDeployInput, ExecutorRollbackInput } from "./types";

let repoModule: typeof import("../db/repo") | null = null;
let runtimeModule: typeof import("../orchestrator/runtime") | null = null;

const railpackGenerator = readFileSync(join(import.meta.dir, "../orchestrator/railpack-config-utils.ts"), "utf8");

const getRepo = async () => (repoModule ??= await import("../db/repo"));
const getRuntime = async () => (runtimeModule ??= await import("../orchestrator/runtime"));

const slugify = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 63);

const buildEnvVars = async (deployment: Deployment) => {
	const { listEnvironmentVariablesForDeploy } = await getRepo();
	const vars = await listEnvironmentVariablesForDeploy(deployment.projectId ?? "", deployment.environment ?? undefined);
	if (vars.length === 0) return undefined;
	const envVars: Record<string, string> = {};
	for (const v of vars) envVars[v.key] = v.value;
	return envVars;
};

const buildVolumes = async (deployment: Deployment) => {
	const { listVolumes } = await getRepo();
	const vols = await listVolumes(deployment.projectId ?? "");
	if (vols.length === 0) return undefined;
	return vols.map((v) => ({
		volumeName: v.dockerVolumeName ?? `vol-${v.id.slice(0, 12)}`,
		mountPath: v.mountPath,
	}));
};

const deployFromImage = async (
	deployment: Deployment,
	project: Project | null,
	server: Server,
	imageTag: string,
	oldDeployment?: Deployment,
) => {
	const { updateDeploymentStatus } = await getRepo();
	const { deployContainer } = await getRuntime();
	const envVars = await buildEnvVars(deployment);
	const volumes = await buildVolumes(deployment);
	const runtime = await deployContainer(
		deployment.id,
		imageTag,
		async (line) => {
			await emitLog(deployment.id, "deploy", line);
		},
		{
			projectId: deployment.projectId ?? undefined,
			projectName: project?.name,
			baseDomain: project?.baseDomain,
			oldContainerName: oldDeployment?.containerName ?? undefined,
			oldDeploymentId: oldDeployment?.id,
			envVars,
			volumes,
			cpuLimit: project?.cpuLimit,
			memoryLimitMb: project?.memoryLimitMb,
			appPort: project?.port,
			targetServer: server,
		},
	);
	await updateDeploymentStatus(deployment.id, "running", {
		containerName: runtime.containerName,
		liveUrl: runtime.liveUrl,
		imageTag,
	});
	await emitLog(deployment.id, "system", "Deployment is running");
	return runtime;
};

const deployComposeRemote = async (deployment: Deployment, project: Project, server: Server) => {
	const { listEnvironmentVariablesForDeploy, listDeployments, updateDeploymentStatus } = await getRepo();
	await updateDeploymentStatus(deployment.id, "building", { failureReason: null });
	await emitLog(deployment.id, "system", `Deploying compose stack on server ${server.name} over SSH`);

	const envVars = await listEnvironmentVariablesForDeploy(project.id, deployment.environment ?? undefined);

	const script = buildRemoteComposeScript({
		deploymentId: deployment.id,
		workspaceRoot: config.workspaceRoot,
		gitUrl: deployment.sourceRef,
		branch: deployment.branch,
		commitSha: deployment.commitSha,
		projectName: project.name,
		dockerNetwork: config.dockerNetwork,
		environmentVariables: envVars,
		sourceDir: project.sourceDir,
	});

	const result = await runRemoteScript(server, script, {
		onLog: async (line) => {
			await emitLog(deployment.id, "build", line);
		},
	});
	if (result.code !== 0) throw new Error(remoteScriptFailure(result, "Remote compose build failed"));

	const composeResult = parseRemoteComposeResult(result.stdout);
	if (!composeResult) throw new Error("Remote compose completed without a result marker");

	await updateDeploymentStatus(deployment.id, "deploying");
	await emitLog(deployment.id, "system", "Compose stack started — configuring routes");

	const all = await listDeployments(project.id);
	const current = all.find((d) => d.status === "running" && d.id !== deployment.id);

	const slug = slugify(project.name);
	const primaryServiceName = project.composeService || Object.keys(composeResult.containers)[0];
	const _primaryContainer =
		composeResult.containers[primaryServiceName] || `deploy-${deployment.id}-${primaryServiceName}-1`;

	let customMappings: { serviceName: string; port: number | string; subdomain?: string }[] = [];
	if (project.composeServices) {
		if (typeof project.composeServices === "string") {
			try {
				customMappings = JSON.parse(project.composeServices);
			} catch {}
		} else if (Array.isArray(project.composeServices)) {
			customMappings = project.composeServices;
		}
	}

	const webServices: { name: string; container: string; port: number }[] = [];
	for (const [svcName, svcContainer] of Object.entries(composeResult.containers)) {
		const mapping = customMappings.find((c) => c.serviceName === svcName);
		if (mapping) {
			webServices.push({ name: svcName, container: svcContainer, port: Number(mapping.port) || 3000 });
		} else if (svcName === primaryServiceName) {
			webServices.push({
				name: svcName,
				container: svcContainer,
				port: project.composePort || composeResult.ports[svcName] || 3000,
			});
		} else {
			webServices.push({ name: svcName, container: svcContainer, port: composeResult.ports[svcName] || 3000 });
		}
	}

	const { buildCaddySnippet } = await import("../utils/domain-verifier");
	const { shouldRouteViaIngress, syncIngressRoute, upsertIngressRoute } = await import("../utils/ingress");
	const { baseDomainFor } = await import("../utils/routes");
	const { getIngressServer } = await import("../utils/ingress");
	const { upsertRoute } = await import("../db/repo");

	const ingressServer = await getIngressServer();
	const viaIngress = shouldRouteViaIngress(server, ingressServer);
	const primary = webServices.find((s) => s.name === primaryServiceName) || webServices[0];

	let snippet = await buildCaddySnippet(slug, primary.container, project.id, undefined, primary.port);

	const rawBaseDomain = config.caddyBaseDomain || "localhost";
	const baseDomainForCaddy = rawBaseDomain === "localhost" ? `${rawBaseDomain}:80` : rawBaseDomain;

	if (!snippet.trim() || snippet.trim().startsWith(":")) {
		const fallbackDomain = `${slug}.${rawBaseDomain === "localhost" ? "localhost" : rawBaseDomain}`;
		const domain = rawBaseDomain === "localhost" ? `${fallbackDomain}:80` : fallbackDomain;
		snippet = `${domain} {\n  log {\n    output stdout\n    format json\n  }\n  reverse_proxy ${primary.container}:${primary.port} {\n    header_up Host {upstream_hostport}\n  }\n}\n`;
	}
	const { isDbServiceName } = await import("../utils/compose-ingress");
	for (const svc of webServices) {
		if (svc.name === primaryServiceName) continue;
		if (isDbServiceName(svc.name)) continue;
		const customMatch = customMappings.find((c) => c.serviceName === svc.name);
		const domains: string[] = [];
		if (customMatch?.subdomain?.trim()) {
			domains.push(`${customMatch.subdomain.trim()}.${slug}.${baseDomainForCaddy}`);
		} else {
			domains.push(`${svc.name}.${slug}.${baseDomainForCaddy}`);
			if (svc.name === "server" && !domains.includes(`api.${slug}.${baseDomainForCaddy}`)) {
				domains.push(`api.${slug}.${baseDomainForCaddy}`);
			}
		}
		snippet += `\n${domains.join(", ")} {\n  log {\n    output stdout\n    format json\n  }\n  reverse_proxy ${svc.container}:${svc.port} {\n    header_up Host {upstream_hostport}\n  }\n}\n`;
	}

	const hostname = `${slug}.${baseDomainFor()}`;
	const primaryPort = primary.port;
	const allContainerNames = webServices.map((s) => s.container);

	let effectiveSnippet: string;
	if (viaIngress) {
		const blockRegex = /^([^\n]+?)\s*\{\n([\s\S]*?)\n\}\s*$/gm;
		effectiveSnippet = snippet.replace(blockRegex, (_match, domainLine: string, body: string) => {
			const domains = domainLine.split(",").map((d: string) => d.trim());
			const portedDomains = domains.map((d: string) => {
				const stripped = d.replace(/:\d+$/, "");
				return `${stripped}:80`;
			});
			return `${portedDomains.join(", ")} {\n${body}\n}`;
		});
	} else {
		effectiveSnippet = snippet;
	}

	if (server.mode === "ssh" || server.mode === "docker_tcp") {
		await syncRemoteCaddyRoute(server, `${slug}.caddy`, effectiveSnippet);
		await upsertRoute({
			serverId: server.id,
			deploymentId: deployment.id,
			projectId: project.id,
			hostname,
			routeFile: `${slug}.caddy`,
			port: primaryPort,
			targetContainers: allContainerNames,
			status: "active",
		});
	}

	if (viaIngress && ingressServer) {
		const { computeComposeIngressHostnames, syncComposeIngressRoutes } = await import("../utils/compose-ingress");
		const allHostnames = computeComposeIngressHostnames(
			webServices.map((s) => ({ name: s.name, port: s.port })),
			primaryServiceName,
			slug,
			baseDomainFor(),
			customMappings,
		);
		await emitLog(
			deployment.id,
			"system",
			`Registering ${allHostnames.length} ingress route(s) on ${ingressServer.name}: ${allHostnames.map((h) => h.hostname).join(", ")}`,
		);
		await syncComposeIngressRoutes(ingressServer, server, deployment, project, allHostnames);
	}

	const scheme = rawBaseDomain === "localhost" ? "http" : "https";
	const liveUrl = `${scheme}://${hostname}`;

	await updateDeploymentStatus(deployment.id, "running", {
		containerName: composeResult.projectName,
		liveUrl,
	});
	await emitLog(deployment.id, "system", `Deployment is running at ${liveUrl}`);

	if (current) {
		await updateDeploymentStatus(current.id, "inactive", {
			failureReason: `Superseded by deployment ${deployment.id.slice(0, 8)}`,
		});
		await emitLog(current.id, "system", `Marked inactive (superseded by ${deployment.id.slice(0, 8)})`);
	}
};

const markFailed = async (deploymentId: string, error: unknown) => {
	const { recordDeploymentFailure } = await getRepo();
	const message = summarizeDeploymentError(error);
	await emitLog(deploymentId, "system", `Deployment failed: ${message}`);
	await recordDeploymentFailure({ deploymentId, reason: message, source: "ssh" });
};

const remoteBuilds = new Map<string, { controller: AbortController; pgid?: string }>();

export const parseRemoteBuildPgid = (line: string): string | undefined => {
	const match = line.match(/DEQUEL_PGID:\s*(\d+)/);
	return match?.[1];
};

export const killRemoteBuildGroup = async (
	server: Parameters<typeof runRemoteScript>[0],
	pgid: string,
	run: typeof runRemoteScript = runRemoteScript,
): Promise<void> => {
	await run(
		server,
		`kill -TERM -- -${pgid} 2>/dev/null || true
sleep 3
kill -KILL -- -${pgid} 2>/dev/null || true`,
	).catch(() => {});
};

export const sshExecutor: DeploymentExecutor = {
	mode: "ssh",

	async deploy({ deployment, project, server }: ExecutorDeployInput) {
		if (deployment.sourceType !== "git") throw new Error("SSH mode currently supports Git deployments only");
		if (!project) throw new Error("Deployment requires a project");

		if (project.buildType === "compose") {
			try {
				await deployComposeRemote(deployment, project, server);
			} catch (error) {
				await markFailed(deployment.id, error);
			}
			return;
		}

		const { listEnvironmentVariablesForDeploy, listDeployments, updateDeploymentStatus } = await getRepo();
		await updateDeploymentStatus(deployment.id, "building", { failureReason: null });
		await emitLog(
			deployment.id,
			"system",
			`Deploying on server ${server.name} over SSH (build runs on the target machine)`,
		);

		const imageTag = `${slugify(project.name)}-${deployment.id.slice(0, 8)}:latest`;
		const envVars = await listEnvironmentVariablesForDeploy(project.id, deployment.environment ?? undefined);
		const pgidEcho = `echo "DEQUEL_PGID:$(ps -o pgid= -p $$ | tr -d ' ')"`;
		const script = `${pgidEcho}\n${buildRemoteDeployScript({
			deploymentId: deployment.id,
			workspaceRoot: config.workspaceRoot,
			gitUrl: deployment.sourceRef,
			branch: deployment.branch,
			commitSha: deployment.commitSha,
			imageTag,
			clearCache: deployment.clearCache ?? false,
			environmentVariables: envVars,
			sourceDir: project.sourceDir,
			projectType: project.projectType,
			buildCommand: project.buildCommand,
			installCommand: project.installCommand,
			outputDir: project.outputDir,
			startCommand: project.startCommand,
			railpackGenerator,
		})}`;

		const buildEntry = { controller: new AbortController() };
		remoteBuilds.set(deployment.id, buildEntry);
		try {
			const result = await runRemoteScript(server, script, {
				signal: buildEntry.controller.signal,
				onLog: async (line) => {
					const pgid = parseRemoteBuildPgid(line);
					if (pgid) {
						buildEntry.pgid = pgid;
						return;
					}
					await emitLog(deployment.id, "build", line);
				},
			});
			if (result.code !== 0) throw new Error(remoteScriptFailure(result, "Remote build failed"));

			const buildResult = parseRemoteBuildResult(result.stdout);
			if (!buildResult) throw new Error("Remote build completed without a result marker");

			await updateDeploymentStatus(deployment.id, "deploying");
			await emitLog(deployment.id, "system", "Build complete — starting container on server");

			const all = await listDeployments(project.id);
			const current = all.find((d) => d.status === "running" && d.id !== deployment.id);

			await deployFromImage(deployment, project, server, buildResult.imageTag, current);

			if (current) {
				await updateDeploymentStatus(current.id, "inactive", {
					failureReason: `Superseded by deployment ${deployment.id.slice(0, 8)}`,
				});
				await emitLog(current.id, "system", `Marked inactive (superseded by ${deployment.id.slice(0, 8)})`);
			}
		} catch (error) {
			if (!(error instanceof RemoteScriptAbortedError)) {
				await markFailed(deployment.id, error);
			}
		} finally {
			remoteBuilds.delete(deployment.id);
		}
	},

	async rollback({ deployment, project, server, imageTag }: ExecutorRollbackInput) {
		if (project?.buildType === "compose") {
			throw new Error(
				"Rollback is not supported for Docker Compose deployments. Redeploy with the desired commit instead.",
			);
		}
		const { getProjectById, listDeployments, updateDeploymentStatus } = await getRepo();
		await updateDeploymentStatus(deployment.id, "deploying");
		await emitLog(deployment.id, "system", `Rolling back to this version (image: ${imageTag})`);
		try {
			const all = await listDeployments(deployment.projectId ?? "");
			const current = all.find((d) => d.status === "running" && d.id !== deployment.id);
			const resolvedProject = project ?? (deployment.projectId ? await getProjectById(deployment.projectId) : null);
			const runtime = await deployFromImage(deployment, resolvedProject, server, imageTag, current);
			if (current) {
				await updateDeploymentStatus(current.id, "inactive", {
					failureReason: `Superseded by rollback to ${deployment.id.slice(0, 8)}`,
				});
				await emitLog(current.id, "system", `Marked inactive (rolled back to ${deployment.id.slice(0, 8)})`);
			}
			return runtime;
		} catch (error) {
			const message = summarizeDeploymentError(error);
			await emitLog(deployment.id, "system", `Rollback failed: ${message}`);
			const { recordDeploymentFailure, updateDeploymentStatus } = await getRepo();
			const r = await recordDeploymentFailure({ deploymentId: deployment.id, reason: message, source: "rollback" });
			if (!r.claimed) await updateDeploymentStatus(deployment.id, "failed", { failureReason: message });
			throw error;
		}
	},

	async destroy({ deployment, project, server }) {
		const { deleteDeploymentAndLogs, deleteRoutesByDeployment } = await getRepo();
		const { tryRun } = await getRuntime();

		if (project?.buildType === "compose" && deployment.containerName) {
			const script = buildRemoteComposeDestroyScript(deployment.containerName);
			await runRemoteScript(server, script, {
				onLog: async (line) => {
					await emitLog(deployment.id, "system", line);
				},
			});
		} else if (deployment.containerName) {
			await tryRun("docker", ["stop", "-t", "5", deployment.containerName], server);
			await tryRun("docker", ["rm", "-f", deployment.containerName], server);
		}
		if (deployment.imageTag && deployment.sourceType !== "image") {
			await tryRun("docker", ["rmi", "-f", deployment.imageTag], server);
		}
		const slug = slugify(project?.name || deployment.projectId || deployment.id);
		await removeRemoteCaddyRoute(server, `${slug}.caddy`);
		const { getIngressServer, removeIngressRouteFile } = await import("../utils/ingress");
		const ingressServer = await getIngressServer();
		if (ingressServer && ingressServer.id !== server.id) {
			const { listRoutesByDeployment } = await getRepo();
			const deploymentRoutes = await listRoutesByDeployment(deployment.id);
			for (const route of deploymentRoutes) {
				if (route.routeFile !== `${slug}.caddy`) {
					await removeRemoteCaddyRoute(server, route.routeFile);
				}
				if (route.upstreamHost) {
					await removeIngressRouteFile(ingressServer, {
						hostname: route.hostname,
						routeFile: route.routeFile,
					});
				}
			}
		}
		await deleteRoutesByDeployment(deployment.id);
		await deleteDeploymentAndLogs(deployment.id);
	},

	async cancel({ deployment, server }: ExecutorCancelInput) {
		const { recordDeploymentCancellation } = await getRepo();
		if (deployment.status !== "pending" && deployment.status !== "building") return;
		await recordDeploymentCancellation({
			deploymentId: deployment.id,
			reason: CANCELLED_FAILURE_REASON,
			source: "ssh",
		});
		const entry = remoteBuilds.get(deployment.id);
		let remoteStopped = false;
		if (entry) {
			entry.controller.abort();
			if (entry.pgid) {
				remoteStopped = true;
				killRemoteBuildGroup(server, entry.pgid).catch(() => {});
			}
		}
		await emitLog(
			deployment.id,
			"system",
			remoteStopped
				? "Deployment cancelled by user — remote build processes stopped"
				: "Deployment cancelled by user (remote build may continue on the server)",
		);
	},
};
