import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { Elysia } from "elysia";
import {
	createDeployment,
	countDeployments,
	getDeploymentById,
	getLogs,
	listDeployments,
} from "../../db/repo";
import { orchestrator } from "../../orchestrator";
import { logBus } from "../../orchestrator/log-bus";
import { config } from "../../utils/config";

export const deploymentsRoutes = new Elysia()
	.get(
		"/deployments",
		async ({ query }: any) => {
			const offset = Number(query.offset) || 0;
			const limit = Math.min(Number(query.limit) || 50, 100);
			const projectId = query.projectId;
			const [items, total] = await Promise.all([
				listDeployments(projectId, offset, limit),
				countDeployments(projectId),
			]);
			return { items, total, offset, limit };
		},
	)
	.get(
		"/deployments/:id",
		async ({ params: { id }, set }) => {
			const deployment = await getDeploymentById(id);
			if (!deployment) {
				set.status = 404;
				return { error: "Deployment not found" };
			}
			return deployment;
		},
	)
	.post(
		"/deployments",
		async ({ request, set }) => {
			const contentType =
				request.headers.get("content-type") ??
				"";
			if (!contentType.includes("multipart/form-data")) {
				set.status = 400;
				return {
					error: "Expected multipart/form-data payload",
				};
			}
			const form = await request.formData();
			const sourceType = String(
				form.get("sourceType") ?? "",
			);
			const projectId =
				String(form.get("projectId") ?? "").trim() ||
				undefined;
			const branch =
				String(form.get("branch") ?? "").trim() ||
				undefined;
			const environment =
				String(form.get("environment") ?? "").trim() ||
				undefined;
			if (
				sourceType !== "git" &&
				sourceType !== "upload" &&
				sourceType !== "compose"
			) {
				set.status = 400;
				return {
					error: "sourceType must be git, upload, or compose",
				};
			}
			if (sourceType === "git") {
				const gitUrl = String(form.get("gitUrl") ?? "").trim();
				if (!gitUrl) {
					set.status = 400;
					return {
						error: "gitUrl is required for git source",
					};
				}
				const deployment = await createDeployment({
					projectId,
					sourceType: "git",
					sourceRef: gitUrl,
					branch,
					environment,
				});
				orchestrator.enqueue(deployment.id);
				return deployment;
			}
			const file = form.get("archive");
			if (!(file instanceof File)) {
				set.status = 400;
				return {
					error: "archive file is required for upload source",
				};
			}
			const uploadsDir = join(
				config.workspaceRoot,
				"uploads",
			);
			await mkdir(uploadsDir, { recursive: true });
			const safeName = basename(file.name || "project.zip").replace(
				/[^a-zA-Z0-9._-]/g,
				"_",
			);
			const uploadPath = join(
				uploadsDir,
				`${Date.now()}-${safeName}`,
			);
			const bytes = new Uint8Array(await file.arrayBuffer());
			await writeFile(uploadPath, bytes);
			const deployment = await createDeployment({
				projectId,
				sourceType: "upload",
				sourceRef: uploadPath,
				branch,
				environment,
			});
			orchestrator.enqueue(deployment.id);
			return deployment;
		},
	)
	.post(
		"/deployments/:id/rollback",
		async ({ params: { id }, set }) => {
			const original = await getDeploymentById(id);
			if (!original) {
				set.status = 404;
				return { error: "Deployment not found" };
			}
			if (!original.imageTag) {
				set.status = 400;
				return {
					error: "Deployment has no built image to rollback to",
				};
			}
			if (original.projectId) {
				const newer = await listDeployments(original.projectId, 0, 1);
				const isLatest = newer.length > 0 && newer[0].id === id;
				if (isLatest) {
					set.status = 400;
					return {
						error: "Cannot rollback to the latest deployment — deploy a newer version first",
					};
				}
			}
			const deployment = await createDeployment({
				projectId: original.projectId || undefined,
				sourceType: "image",
				sourceRef: original.imageTag,
			});
			orchestrator.enqueue(deployment.id);
			return deployment;
		},
	)
	.post(
		"/deployments/:id/redeploy",
		async ({ params: { id }, set }) => {
			const original = await getDeploymentById(id);
			if (!original) {
				set.status = 404;
				return { error: "Deployment not found" };
			}
			if (original.sourceType === "image") {
				set.status = 400;
				return {
					error: "Cannot redeploy an image-based (rollback) deployment — rollback to an earlier source deployment instead",
				};
			}
			const deployment = await createDeployment({
				projectId: original.projectId || undefined,
				sourceType: original.sourceType,
				sourceRef: original.sourceRef,
				branch: original.branch || undefined,
				environment: original.environment || undefined,
			});
			orchestrator.enqueue(deployment.id);
			return deployment;
		},
	)
	.get(
		"/deployments/:id/logs",
		async ({ params: { id }, set }) => {
			const deployment = await getDeploymentById(id);
			if (!deployment) {
				set.status = 404;
				return { error: "Deployment not found" };
			}
			return getLogs(id);
		},
	)
	.get(
		"/deployments/:id/logs/stream",
		async ({ params: { id }, request, set }) => {
			const deployment = await getDeploymentById(id);
			if (!deployment) {
				set.status = 404;
				return { error: "Deployment not found" };
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
						controller.enqueue(
							encoder.encode(
								`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`,
							),
						);
					};
					send("ready", { deploymentId: id });
					unsubscribe = logBus.subscribe(id, (event) =>
						send("log", event),
					);
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
		},
	)
	.get(
		"/deployments/:id/runtime-logs",
		async ({ params: { id }, set }) => {
			const deployment = await getDeploymentById(id);
			if (!deployment) {
				set.status = 404;
				return { error: "Deployment not found" };
			}
			const { run } = await import("../../orchestrator/runtime");
			const containerName =
				deployment.containerName || `deploy-${id}`;
			try {
				const output = await run("docker", [
					"logs",
					"--tail",
					"200",
					containerName,
				]);
				const lines = output
					.split("\n")
					.filter(Boolean)
					.map((line, i) => ({
						sequence: i + 1,
						message: line,
						timestamp: new Date().toISOString(),
						stage: "runtime" as const,
					}));
				return lines;
			} catch {
				return [];
			}
		},
	)
	.get(
		"/deployments/:id/runtime-logs/stream",
		async ({ params: { id }, request, set }) => {
			const deployment = await getDeploymentById(id);
			if (!deployment) {
				set.status = 404;
				return { error: "Deployment not found" };
			}
			const encoder = new TextEncoder();
			const containerName =
				deployment.containerName || `deploy-${id}`;
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
						controller.enqueue(
							encoder.encode(
								`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`,
							),
						);
					};
					const { spawn } = await import(
						"node:child_process",
					);
					const child = spawn(
						"docker",
						[
							"logs",
							"--tail",
							"100",
							"--follow",
							containerName,
						],
						{
							stdio: ["ignore", "pipe", "pipe"],
						},
					);
					let seq = 0;
					child.stdout.on("data", (chunk: Buffer) => {
						const lines = chunk
							.toString()
							.split("\n")
							.filter(Boolean);
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
						const lines = chunk
							.toString()
							.split("\n")
							.filter(Boolean);
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
					child.on("close", () =>
						send("close", { reason: "container stopped" }),
					);
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
		},
	);
