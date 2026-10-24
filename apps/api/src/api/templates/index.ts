import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Elysia } from "elysia";
import type {
	CreateDeploymentInput,
	CreateEnvironmentVariableInput,
	CreateProjectInput,
	Deployment,
	Project,
	Server,
} from "../../types";
import { created, fail, ok } from "../response";
import { getTemplate, listTemplates, type RenderedTemplate, renderCompose } from "./registry";
import type { DeployTemplate } from "./types";

interface TemplateRepo {
	createProject: (input: CreateProjectInput) => Promise<Project>;
	createDeployment: (input: CreateDeploymentInput) => Promise<Deployment>;
	createEnvironmentVariable: (input: CreateEnvironmentVariableInput) => Promise<unknown>;
	getServerById: (id: string) => Promise<Server | null>;
	listProjects: () => Promise<Project[]>;
	deleteProjectCascade?: (id: string) => Promise<unknown>;
}

export interface TemplateRouteOverrides {
	repo?: TemplateRepo;
	resolveServerId?: (preferred?: string | null, exclude?: string | null, modes?: string[]) => Promise<string>;
	enqueue?: (deploymentId: string) => void;
	workspaceRoot?: string;
}

type DeployBody = {
	name?: unknown;
	description?: unknown;
	serverId?: unknown;
	values?: unknown;
};

const isObjectType = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const templateMeta = (t: DeployTemplate) => ({
	key: t.key,
	name: t.name,
	description: t.description,
	category: t.category,
	docsUrl: t.docsUrl,
	service: t.service,
	port: t.port,
	vars: t.vars.map((v) => ({
		key: v.key,
		label: v.label,
		description: v.description,
		default: v.default,
		secret: v.secret ?? false,
		required: !v.default,
	})),
});

export const createTemplateRoutes = (overrides?: TemplateRouteOverrides): Elysia => {
	const loadRepo = async (): Promise<TemplateRepo> =>
		overrides?.repo ?? ((await import("../../db/repo")) as any as TemplateRepo);

	const resolveServer = async (
		preferred?: string | null,
		exclude?: string | null,
		modes?: string[],
	): Promise<string> => {
		if (overrides?.resolveServerId) return overrides.resolveServerId(preferred, exclude, modes);
		const { resolveDefaultServerId } = await import("../../utils/server-default");
		return resolveDefaultServerId(preferred, exclude, modes);
	};

	const enqueueDeployment = async (deploymentId: string): Promise<void> => {
		if (overrides?.enqueue) return overrides.enqueue(deploymentId);
		const { orchestrator } = await import("../../orchestrator");
		orchestrator.enqueue(deploymentId);
	};

	const uploadsDir = async (): Promise<string> => {
		if (overrides?.workspaceRoot) return join(overrides.workspaceRoot, "uploads");
		const { config } = await import("../../utils/config");
		return join(config.workspaceRoot, "uploads");
	};

	return new Elysia()
		.get("/templates", () => ok(listTemplates().map(templateMeta)))
		.get("/templates/:key", ({ params: { key }, set }) => {
			const template = getTemplate(key);
			if (!template) {
				set.status = 404;
				return fail(`Unknown template "${key}"`);
			}
			return ok(templateMeta(template));
		})
		.post("/templates/:key/deployments", async ({ params: { key }, body, set }: any) => {
			const template = getTemplate(key);
			if (!template) {
				set.status = 404;
				return fail(`Unknown template "${key}"`);
			}
			const input: DeployBody = isObjectType(body) ? (body as DeployBody) : {};
			const values: Record<string, string> = isObjectType(input.values) ? (input.values as Record<string, string>) : {};

			let rendered: RenderedTemplate;
			try {
				rendered = renderCompose(template, values);
			} catch (error) {
				set.status = 400;
				return fail(error instanceof Error ? error.message : "Failed to render template");
			}

			const name = String(input.name ?? template.name).trim();
			if (!name) {
				set.status = 400;
				return fail("Project name is required");
			}

			const repo = await loadRepo();
			const projects = await repo.listProjects();
			if (projects.some((p) => p.name === name)) {
				set.status = 400;
				return fail(`A project named "${name}" already exists`);
			}

			const requestedServerId =
				typeof input.serverId === "string" && input.serverId.trim() ? input.serverId.trim() : undefined;
			let serverId: string | undefined;
			if (requestedServerId) {
				serverId = requestedServerId;
			} else {
				serverId = await resolveServer(undefined, undefined, ["local"]);
				if (!serverId) {
					set.status = 400;
					return fail("No server available for template deployment");
				}
			}
			const server = await repo.getServerById(serverId);
			if (!server) {
				set.status = 400;
				return fail("Selected deployment server does not exist");
			}
			if (server.mode !== "local") {
				set.status = 400;
				return fail("Templates deploy Docker Compose stacks - remote servers support Git sources only right now");
			}

			const dir = await uploadsDir();
			mkdirSync(dir, { recursive: true });
			const archivePath = join(dir, `${Date.now()}-template-${template.key}.zip`);
			const { createZipStore } = await import("../../utils/zip-store");
			writeFileSync(archivePath, createZipStore([{ name: "docker-compose.yml", content: rendered.compose }]));

			const project = await repo.createProject({
				name,
				serverId,
				description:
					typeof input.description === "string"
						? input.description
						: `${template.description} (template: ${template.key})`,
				sourceType: "upload",
				projectType: "web",
				buildType: "compose",
				composeService: template.service,
				composePort: template.port,
			});

			try {
				for (const v of rendered.vars) {
					await repo.createEnvironmentVariable({
						projectId: project.id,
						key: v.key,
						value: v.value,
						environment: "production",
					});
				}
			} catch (error) {
				const cleanupFn = repo.deleteProjectCascade ?? (await import("../../db/repo")).deleteProjectCascade;
				if (cleanupFn) {
					await cleanupFn(project.id).catch(() => {});
				}
				set.status = 500;
				return fail(error instanceof Error ? error.message : "Failed to store template variables");
			}

			let deployment: Deployment;
			try {
				deployment = await repo.createDeployment({
					projectId: project.id,
					serverId,
					sourceType: "upload",
					sourceRef: archivePath,
					environment: "production",
				});
			} catch (error) {
				const cleanupFn = repo.deleteProjectCascade ?? (await import("../../db/repo")).deleteProjectCascade;
				if (cleanupFn) {
					await cleanupFn(project.id).catch(() => {});
				}
				set.status = 500;
				return fail(error instanceof Error ? error.message : "Failed to create deployment");
			}

			await enqueueDeployment(deployment.id);
			return created({ project, deployment });
		});
};

export const templateRoutes = createTemplateRoutes();
