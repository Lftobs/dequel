import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { Elysia } from "elysia";
import { validateRemoteDeployment } from "../../agents/deployments";
import {
	countDeployments,
	createDeployment,
	getDeploymentById,
	getLogs,
	getProjectById,
	getServerById,
	listDeployments,
} from "../../db/repo";
import { executorFor } from "../../executors/dispatch";
import { orchestrator } from "../../orchestrator";
import { logBus } from "../../orchestrator/log-bus";
import { config } from "../../utils/config";
import { isPrivateGitUrl } from "../../utils/validate";
import { created, fail, ok } from "../response";

const dispatchDeployment = async (
	deployment: Awaited<ReturnType<typeof createDeployment>>,
	project: Awaited<ReturnType<typeof getProjectById>>,
	server: Awaited<ReturnType<typeof getServerById>>,
) => {
	if (server.mode === "local") {
		orchestrator.enqueue(deployment.id);
		return;
	}
	if (!project) throw new Error("Remote deployment requires a project");
	if (deployment.sourceType !== "git") throw new Error("Remote servers currently support Git deployments only");
	const executor = executorFor(server.mode);
	if (server.mode === "ssh") {
		void executor.deploy({ deployment, project, server }).catch((error) => {
			console.error(`[SSH Executor] Deployment ${deployment.id} failed:`, error);
		});
		return;
	}
	await executor.deploy({ deployment, project, server });
};

export const deploymentsRoutes = new Elysia()
	.get("/deployments", async ({ query }: any) => {
		const offset = Number(query.offset) || 0;
		const limit = Math.min(Number(query.limit) || 50, 100);
		const projectId = query.projectId;
		const [items, total] = await Promise.all([listDeployments(projectId, offset, limit), countDeployments(projectId)]);
		return ok({ items, total, offset, limit });
	})
	.get("/deployments/:id", async ({ params: { id }, set }) => {
		const deployment = await getDeploymentById(id);
		if (!deployment) {
			set.status = 404;
			return fail("Deployment not found");
		}
		return ok(deployment);
	})
	.post("/deployments", async ({ request, set }) => {
		const contentType = request.headers.get("content-type") ?? "";
		if (!contentType.includes("multipart/form-data")) {
			set.status = 400;
			return fail("Expected multipart/form-data payload");
		}
		const form = await request.formData();
		const sourceType = String(form.get("sourceType") ?? "");
		const projectId = String(form.get("projectId") ?? "").trim() || undefined;
		const project = projectId ? await getProjectById(projectId) : null;
		const { resolveDefaultServerId } = await import("../../utils/server-default");
		const serverId = await resolveDefaultServerId(project?.serverId);
		const server = await getServerById(serverId);
		if (!server) {
			set.status = 400;
			return fail("Selected deployment server does not exist");
		}
		const branch = String(form.get("branch") ?? "").trim() || undefined;
		const environment = String(form.get("environment") ?? "").trim() || undefined;
		const commitSha = String(form.get("commitSha") ?? "").trim() || undefined;
		const clearCache = form.get("clearCache") === "true";
		const resolvedBranch =
			branch || (projectId ? (await getProjectById(projectId))?.repoBranch || undefined : undefined);
		if (sourceType !== "git" && sourceType !== "upload" && sourceType !== "compose") {
			set.status = 400;
			return fail("sourceType must be git, upload, or compose");
		}
		if (sourceType === "git") {
			const gitUrl = String(form.get("gitUrl") ?? "").trim();
			if (!gitUrl) {
				set.status = 400;
				return fail("gitUrl is required for git source");
			}
			if (isPrivateGitUrl(gitUrl)) {
				set.status = 400;
				return fail("Private network Git endpoints are not allowed");
			}
			if (server.mode === "agent") {
				if (!project) {
					set.status = 400;
					return fail("Remote deployment requires a project");
				}
				const preview = {
					id: "validation",
					projectId: project.id,
					serverId,
					sourceType: "git" as const,
					sourceRef: gitUrl,
					branch: resolvedBranch ?? null,
					commitSha: commitSha ?? null,
				} as any;
				const error = validateRemoteDeployment(preview, project);
				if (error) {
					set.status = 400;
					return fail(error);
				}
			}
			const deployment = await createDeployment({
				projectId,
				serverId,
				sourceType: "git",
				sourceRef: gitUrl,
				branch: resolvedBranch,
				environment,
				commitSha,
				clearCache,
			});
			await dispatchDeployment(deployment, project, server);
			return created(deployment);
		}
		const file = form.get("archive");
		if (server.mode === "agent" || server.mode === "ssh") {
			set.status = 400;
			return fail("Remote servers currently support Git deployments only");
		}
		if (!(file instanceof File)) {
			set.status = 400;
			return fail("archive file is required for upload source");
		}
		const uploadsDir = join(config.workspaceRoot, "uploads");
		await mkdir(uploadsDir, { recursive: true });
		const safeName = basename(file.name || "project.zip").replace(/[^a-zA-Z0-9._-]/g, "_");
		const uploadPath = join(uploadsDir, `${Date.now()}-${safeName}`);
		const bytes = new Uint8Array(await file.arrayBuffer());
		await writeFile(uploadPath, bytes);
		const deployment = await createDeployment({
			projectId,
			serverId,
			sourceType: "upload",
			sourceRef: uploadPath,
			branch: resolvedBranch,
			environment,
			clearCache,
		});
		await dispatchDeployment(deployment, project, server);
		return created(deployment);
	})
	.post("/deployments/:id/rollback", async ({ params: { id }, set }) => {
		const target = await getDeploymentById(id);
		if (!target) {
			set.status = 404;
			return fail("Deployment not found");
		}
		if (!target.imageTag) {
			set.status = 400;
			return fail("Deployment has no built image to rollback to");
		}
		if (target.status === "running") {
			set.status = 400;
			return fail("Cannot rollback to the currently running deployment");
		}
		if (target.status === "pending" || target.status === "building" || target.status === "deploying") {
			set.status = 400;
			return fail("Cannot rollback to a deployment that is still in progress");
		}
		const project = target.projectId ? await getProjectById(target.projectId) : null;
		if (project?.buildType === "compose") {
			set.status = 400;
			return fail("Rollback is not supported for Docker Compose deployments");
		}
		try {
			const server = await getServerById(target.serverId ?? "local");
			if (!server) {
				set.status = 400;
				return fail("Deployment server does not exist");
			}
			const executor = executorFor(server.mode);
			await executor.rollback({ deployment: target, project, server });
			const updated = await getDeploymentById(id);
			return ok(updated);
		} catch (err: any) {
			set.status = 500;
			return fail(err.message || "Rollback failed");
		}
	})
	.post("/deployments/:id/redeploy", async ({ params: { id }, set }) => {
		const original = await getDeploymentById(id);
		if (!original) {
			set.status = 404;
			return fail("Deployment not found");
		}
		if (original.status !== "running") {
			set.status = 400;
			return fail("Can only redeploy the currently running deployment");
		}
		if (original.sourceType === "image") {
			set.status = 400;
			return fail(
				"Cannot redeploy an image-based (rollback) deployment — rollback to an earlier source deployment instead",
			);
		}
		const project = original.projectId ? await getProjectById(original.projectId) : null;
		const server = await getServerById(original.serverId ?? "local");
		if (!server) {
			set.status = 400;
			return fail("Selected deployment server does not exist");
		}
		const deployment = await createDeployment({
			projectId: original.projectId || undefined,
			serverId: original.serverId,
			sourceType: original.sourceType,
			sourceRef: original.sourceRef,
			branch: original.branch || project?.repoBranch || undefined,
			environment: original.environment || undefined,
		});
		await dispatchDeployment(deployment, project, server);
		return created(deployment);
	})
	.post("/deployments/:id/cancel", async ({ params: { id }, set }) => {
		const deployment = await getDeploymentById(id);
		if (!deployment) {
			set.status = 404;
			return fail("Deployment not found");
		}
		if (deployment.status !== "pending" && deployment.status !== "building") {
			set.status = 400;
			return fail("Only pending or building deployments can be cancelled");
		}
		const server = await getServerById(deployment.serverId ?? "local");
		if (!server) {
			set.status = 400;
			return fail("Deployment server does not exist");
		}
		const executor = executorFor(server.mode);
		await executor.cancel({ deployment, server });
		return ok(null, "Deployment cancelled");
	})
	.delete("/deployments/:id", async ({ params: { id }, set }) => {
		const deployment = await getDeploymentById(id);
		if (!deployment) {
			set.status = 404;
			return fail("Deployment not found");
		}
		if (deployment.status === "running") {
			set.status = 400;
			return fail("Cannot delete a running deployment — stop it first");
		}
		const project = deployment.projectId ? await getProjectById(deployment.projectId) : null;
		const server = await getServerById(deployment.serverId ?? "local");
		if (!server) {
			set.status = 400;
			return fail("Deployment server does not exist");
		}
		const executor = executorFor(server.mode);
		await executor.destroy({ deployment, project, server });
		return ok(null, "Deployment deleted");
	})
	.get("/deployments/:id/logs", async ({ params: { id }, set }) => {
		const deployment = await getDeploymentById(id);
		if (!deployment) {
			set.status = 404;
			return fail("Deployment not found");
		}
		return ok(await getLogs(id));
	})
	.get("/deployments/:id/logs/stream", async ({ params: { id }, request, set }) => {
		const deployment = await getDeploymentById(id);
		if (!deployment) {
			set.status = 404;
			return fail("Deployment not found");
		}
		const encoder = new TextEncoder();
		let unsubscribe = () => undefined;
		let heartbeat: ReturnType<typeof setInterval> | null = null;
		let closed = false;
		const stop = () => {
			if (closed) return;
			closed = true;
			unsubscribe();
			if (heartbeat) clearInterval(heartbeat);
		};
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				const send = (eventName: string, payload: unknown) => {
					if (closed) return;
					controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`));
				};
				send("ready", { deploymentId: id });
				unsubscribe = logBus.subscribe(id, (event) => send("log", event));
				heartbeat = setInterval(
					() =>
						send("heartbeat", {
							at: new Date().toISOString(),
						}),
					15000,
				);
			},
			cancel: stop,
		});
		request.signal.addEventListener("abort", stop, {
			once: true,
		});
		set.headers["content-type"] = "text/event-stream";
		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	})
	.get("/deployments/:id/runtime-logs", async ({ params: { id }, set }) => {
		const deployment = await getDeploymentById(id);
		if (!deployment) {
			set.status = 404;
			return fail("Deployment not found");
		}
		const { run } = await import("../../orchestrator/runtime");
		const containerName = deployment.containerName || `deploy-${id}`;
		try {
			const output = await run("docker", ["logs", "--tail", "200", containerName]);
			const lines = output
				.split("\n")
				.filter(Boolean)
				.map((line, i) => ({
					sequence: i + 1,
					message: line,
					timestamp: new Date().toISOString(),
					stage: "runtime" as const,
				}));
			return ok(lines);
		} catch {
			return ok([]);
		}
	})
	.get("/deployments/:id/runtime-logs/stream", async ({ params: { id }, request, set }) => {
		const deployment = await getDeploymentById(id);
		if (!deployment) {
			set.status = 404;
			return fail("Deployment not found");
		}
		const encoder = new TextEncoder();
		const containerName = deployment.containerName || `deploy-${id}`;
		let closed = false;
		const stop = () => {
			closed = true;
		};
		request.signal.addEventListener("abort", stop, {
			once: true,
		});
		const stream = new ReadableStream<Uint8Array>({
			async start(controller) {
				const send = (eventName: string, payload: unknown) => {
					if (closed) return;
					controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`));
				};
				const { spawn } = await import("node:child_process");
				const child = spawn("docker", ["logs", "--tail", "100", "--follow", containerName], {
					stdio: ["ignore", "pipe", "pipe"],
				});
				let seq = 0;
				child.stdout.on("data", (chunk: Buffer) => {
					const lines = chunk.toString().split("\n").filter(Boolean);
					for (const line of lines) {
						seq++;
						send("log", {
							sequence: seq,
							message: line,
							timestamp: new Date().toISOString(),
							stage: "runtime",
						});
					}
				});
				child.stderr.on("data", (chunk: Buffer) => {
					const lines = chunk.toString().split("\n").filter(Boolean);
					for (const line of lines) {
						seq++;
						send("log", {
							sequence: seq,
							message: line,
							timestamp: new Date().toISOString(),
							stage: "runtime",
						});
					}
				});
				child.on("close", () => send("close", { reason: "container stopped" }));
				request.signal.addEventListener(
					"abort",
					() => {
						child.kill();
						stop();
					},
					{ once: true },
				);
			},
			cancel: stop,
		});
		set.headers["content-type"] = "text/event-stream";
		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	});
