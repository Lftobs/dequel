import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { Elysia } from "elysia";
import { parse as parseYaml } from "yaml";
import { createDeployment, listDeployments } from "../../db/repo/deployments";
import { getProjectById, updateProject } from "../../db/repo/projects";
import { getServerById } from "../../db/repo/servers";
import { parseContainerTargetPort } from "../../orchestrator/compose";
import { config } from "../../utils/config";
import { safeSpawn } from "../../utils/process-exec";
import { validateComposeServices } from "../../utils/validate";
import { createZipStore } from "../../utils/zip-store";
import { created, fail, ok } from "../response";
import { getTemplate, listTemplates } from "../templates/registry";
import type { DeployTemplate } from "../templates/types";

const getWorkspaceRoot = (): string => config.workspaceRoot || process.env.WORKSPACE_ROOT || "./workspace";

const readComposeFromArchive = async (archivePath: string): Promise<string | null> => {
	if (!existsSync(archivePath)) return null;
	const candidates = ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"];
	for (const candidate of candidates) {
		try {
			const res = await safeSpawn("unzip", ["-p", archivePath, candidate], { timeoutMs: 10_000 });
			if (res.code === 0 && res.stdout.trim()) {
				return res.stdout;
			}
		} catch {}
	}
	return null;
};

const readComposeFromDir = (dirPath: string): string | null => {
	const candidates = ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"];
	for (const candidate of candidates) {
		const full = join(dirPath, candidate);
		if (existsSync(full)) {
			try {
				return readFileSync(full, "utf8");
			} catch {}
		}
	}
	return null;
};

export const findTemplateForProject = (project: {
	name?: string | null;
	description?: string | null;
	composeService?: string | null;
}): DeployTemplate | undefined => {
	const desc = project.description || "";
	const match = desc.match(/template:\s*([a-zA-Z0-9_-]+)/i);
	if (match?.[1]) {
		const t = getTemplate(match[1]);
		if (t) return t;
	}
	if (project.name) {
		const byName = getTemplate(project.name.toLowerCase());
		if (byName) return byName;
		const stripped = project.name.toLowerCase().replace(/[^a-z0-9]/g, "");
		const found = listTemplates().find(
			(t) =>
				t.key.toLowerCase().replace(/[^a-z0-9]/g, "") === stripped ||
				t.name.toLowerCase().replace(/[^a-z0-9]/g, "") === stripped,
		);
		if (found) return found;
	}
	if (project.composeService) {
		const byService = listTemplates().find((t) => t.service.toLowerCase() === project.composeService?.toLowerCase());
		if (byService) return byService;
	}
	return undefined;
};

const fallbackComposeFor = (project: { composeService?: string | null; composePort?: number | null }) => {
	const primaryService = project.composeService || "app";
	const primaryPort = project.composePort || 80;
	return `version: "3.8"\n\nservices:\n  ${primaryService}:\n    image: nginx:alpine\n    ports:\n      - "${primaryPort}:80"\n`;
};

const isFallbackCompose = (text: string | null | undefined): boolean => {
	if (!text) return false;
	try {
		const parsed = parseYaml(text) as any;
		const services = parsed?.services;
		if (!services || typeof services !== "object") return false;
		const entries = Object.entries(services);
		if (entries.length !== 1) return false;
		const svc = entries[0][1] as any;
		if (svc?.image !== "nginx:alpine") return false;
		const extraKeys = Object.keys(svc).filter((k) => !["image", "ports", "restart"].includes(k));
		if (extraKeys.length > 0) return false;
		const ports = Array.isArray(svc.ports) ? svc.ports : [];
		return ports.length === 1 && String(ports[0]).trim().endsWith(":80");
	} catch {
		return false;
	}
};

export const getOrRecoverProjectCompose = async (project: any): Promise<string> => {
	let recovered: string | null = null;
	let recoveredStub: string | null = null;
	const accept = (candidate: string | null): boolean => {
		if (!candidate) return false;
		if (isFallbackCompose(candidate)) {
			if (!recoveredStub) recoveredStub = candidate;
			return false;
		}
		recovered = candidate;
		return true;
	};

	const deps = await listDeployments(project.id, 0, 10).catch(() => []);
	for (const d of deps) {
		if (d.sourceRef?.endsWith(".zip")) {
			let archiveFile = d.sourceRef;
			if (!existsSync(archiveFile)) {
				const inUploads = join(getWorkspaceRoot(), "uploads", basename(archiveFile));
				if (existsSync(inUploads)) archiveFile = inUploads;
			}
			const candidate = await readComposeFromArchive(archiveFile);
			if (accept(candidate)) break;
		}
	}

	if (!recovered && deps.length > 0) {
		for (const d of deps) {
			const wsDir = join(getWorkspaceRoot(), d.id);
			if (accept(readComposeFromDir(wsDir))) break;
		}
	}

	if (!recovered) {
		const projectWs = join(getWorkspaceRoot(), project.id);
		accept(readComposeFromDir(projectWs));
	}

	if (!recovered) {
		const template = findTemplateForProject(project);
		if (template) {
			const { renderCompose } = await import("../templates/registry");
			const { listEnvironmentVariablesForDeploy } = await import("../../db/repo/env-vars");
			const envs = await listEnvironmentVariablesForDeploy(project.id, "production").catch(() => []);
			const envMap: Record<string, string> = {};
			for (const e of envs) envMap[e.key] = e.value;
			const rendered = renderCompose(template, envMap);
			recovered = rendered.compose;
		}
	}

	if (recovered) {
		if (!recovered.trim().startsWith("version:")) {
			recovered = `version: "3.8"\n\n${recovered.trim()}`;
		}
		return recovered;
	}

	return recoveredStub ?? fallbackComposeFor(project);
};

export const ensureValidComposeArchive = async (project: any, preferredRef?: string | null): Promise<string> => {
	if (preferredRef && existsSync(preferredRef)) {
		const existing = await readComposeFromArchive(preferredRef);
		if (existing && !isFallbackCompose(existing)) return preferredRef;
	}
	if (preferredRef) {
		const inUploads = join(getWorkspaceRoot(), "uploads", basename(preferredRef));
		if (existsSync(inUploads)) {
			const existing = await readComposeFromArchive(inUploads);
			if (existing && !isFallbackCompose(existing)) return inUploads;
		}
	}

	const uploadsDir = join(getWorkspaceRoot(), "uploads");
	mkdirSync(uploadsDir, { recursive: true });

	const compose = await getOrRecoverProjectCompose(project);
	const targetPath = preferredRef ? join(uploadsDir, basename(preferredRef)) : null;
	const targetArchive =
		targetPath && !existsSync(targetPath) ? targetPath : join(uploadsDir, `${Date.now()}-compose-${project.id}.zip`);

	writeFileSync(targetArchive, createZipStore([{ name: "docker-compose.yml", content: compose }]));
	return targetArchive;
};

export const projectComposeRoutes = new Elysia()
	.get("/projects/:id/compose", async ({ params: { id }, set }) => {
		const project = await getProjectById(id);
		if (!project) {
			set.status = 404;
			return fail("Project not found");
		}

		const compose = await getOrRecoverProjectCompose(project);

		return ok({
			compose,
			composeService: project.composeService,
			composePort: project.composePort,
			composeServices: project.composeServices,
		});
	})
	.put("/projects/:id/compose", async ({ params: { id }, body, set }: any) => {
		const project = await getProjectById(id);
		if (!project) {
			set.status = 404;
			return fail("Project not found");
		}

		const compose = typeof body?.compose === "string" ? body.compose.trim() : "";
		if (!compose) {
			set.status = 400;
			return fail("Compose YAML content is required");
		}

		let parsed: any;
		try {
			parsed = parseYaml(compose);
		} catch (e: any) {
			set.status = 400;
			return fail(`Invalid YAML syntax: ${e.message}`);
		}

		if (!parsed || typeof parsed !== "object" || !parsed.services || typeof parsed.services !== "object") {
			set.status = 400;
			return fail("Compose file must contain a 'services' mapping");
		}

		const serviceEntries = Object.entries(parsed.services);
		if (serviceEntries.length === 0) {
			set.status = 400;
			return fail("At least one service must be defined in the compose file");
		}

		const requestedService = typeof body.composeService === "string" ? body.composeService.trim() : "";
		const targetService =
			requestedService && (parsed.services as any)[requestedService] ? requestedService : serviceEntries[0][0];

		let targetPort = body.composePort ? Number(body.composePort) : null;
		if (!targetPort || Number.isNaN(targetPort)) {
			const svcCfg = (parsed.services as any)[targetService];
			if (svcCfg?.ports && Array.isArray(svcCfg.ports)) {
				for (const p of svcCfg.ports) {
					const parsedPort = parseContainerTargetPort(p);
					if (parsedPort) {
						targetPort = parsedPort;
						break;
					}
				}
			}
		}
		if (!targetPort) targetPort = 3000;

		let composeServicesPayload: string | null = null;
		if (body.composeServices) {
			const validation = validateComposeServices(body.composeServices);
			if (!validation.ok) {
				set.status = 400;
				return fail(validation.error);
			}
			composeServicesPayload =
				typeof body.composeServices === "string" ? body.composeServices : JSON.stringify(body.composeServices);
		}

		const uploadsDir = join(getWorkspaceRoot(), "uploads");
		mkdirSync(uploadsDir, { recursive: true });
		const archivePath = join(uploadsDir, `${Date.now()}-compose-${project.id}.zip`);
		writeFileSync(archivePath, createZipStore([{ name: "docker-compose.yml", content: compose }]));

		const serverId = project.serverId || "local";
		const server = await getServerById(serverId);
		if (!server) {
			set.status = 400;
			return fail("Project deployment server not found");
		}

		const updatedProject = await updateProject(project.id, {
			buildType: "compose",
			sourceType: "upload",
			composeService: targetService,
			composePort: targetPort,
			composeServices: (composeServicesPayload ?? project.composeServices) as any,
		});

		const deployment = await createDeployment({
			projectId: project.id,
			serverId,
			sourceType: "upload",
			sourceRef: archivePath,
			environment: "production",
		});

		const { dispatchDeployment } = await import("../deployments");
		await dispatchDeployment(deployment, updatedProject, server);
		return created({ project: updatedProject, deployment });
	});
