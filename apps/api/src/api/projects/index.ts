import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Elysia } from "elysia";
import {
	createProject,
	listProjects,
	getProjectById,
	updateProject,
	deleteProject,
} from "../../db/repo";
import { tryRun, reloadCaddy } from "../../orchestrator/runtime";
import { removeFromCaddyRoute } from "../../utils/domain-verifier";
import { config } from "../../utils/config";
import { dockerBin } from "../../utils/docker-bin";

export const projectsRoutes = new Elysia()
	.get("/projects", async () => listProjects())
	.get(
		"/projects/:id",
		async ({ params: { id }, set }) => {
			const project = await getProjectById(id);
			if (!project) {
				set.status = 404;
				return { error: "Project not found" };
			}
			return project;
		},
	)
	.post(
		"/projects",
		async ({ body, set }: any) => {
			if (!body?.name) {
				set.status = 400;
				return { error: "name is required" };
			}
			const project = await createProject({
				name: body.name,
				description: body.description,
				baseDomain: body.baseDomain,
				repoUrl: body.repoUrl,
				repoBranch: body.repoBranch,
				cpuLimit: body.cpuLimit,
				memoryLimitMb: body.memoryLimitMb,
				port: body.port ? Number(body.port) : null,
				sourceDir: body.sourceDir || null,
				sourceType: body.sourceType || "git",
			});
			return project;
		},
	)
	.patch(
		"/projects/:id",
		async ({ params: { id }, body, set }: any) => {
			const project = await updateProject(id, {
				name: body?.name,
				description: body?.description,
				baseDomain: body?.baseDomain,
				repoUrl: body?.repoUrl,
				repoBranch: body?.repoBranch,
				cpuLimit: body?.cpuLimit,
				memoryLimitMb: body?.memoryLimitMb,
				port: body?.port ? Number(body.port) : body?.port === null ? null : undefined,
				sourceDir: body?.sourceDir ?? undefined,
			});
			if (!project) {
				set.status = 404;
				return { error: "Project not found" };
			}
			return project;
		},
	)
	.delete(
		"/projects/:id",
		async ({ params: { id }, set }) => {
			const info = await deleteProjectCascade(id);
			if (!info) {
				set.status = 404;
				return { error: "Project not found" };
			}

			// Docker containers cleanup
			for (const name of info.deploymentContainerNames) {
				await tryRun(dockerBin, ['stop', '-t', '5', name]);
				await tryRun(dockerBin, ['rm', '-f', name]);
			}
			for (const name of info.databaseContainerNames) {
				await tryRun(dockerBin, ['stop', '-t', '5', name]);
				await tryRun(dockerBin, ['rm', '-f', name]);
			}

			// Docker volumes cleanup
			for (const name of [...info.databaseVolumeNames, ...info.volumeDockerNames]) {
				await tryRun(dockerBin, ['volume', 'rm', '-f', name]);
			}

			// Docker images cleanup
			for (const tag of info.deploymentImageTags) {
				if (tag) await tryRun(dockerBin, ['rmi', '-f', tag]);
			}

			// Remove domains from Caddy route file
			for (const { domain, projectName } of info.domains) {
				await removeFromCaddyRoute(domain, id, projectName);
			}

			// Delete the Caddy route file for this project's slug
			const caddyFilePath = join(config.caddyRoutesDir, `${info.slug}.caddy`);
			await unlink(caddyFilePath).catch(() => {});
			await reloadCaddy().catch(() => {});

			return { ok: true };
		},
	)
	.get(
		"/projects/:id/request-logs",
		async ({ params: { id }, query: queryParams, set }) => {
			const project = await getProjectById(id);
			if (!project) {
				set.status = 404;
				return { error: "Project not found" };
			}
			const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);
			const slug = slugify(project.name);
			const domains = [`${slug}.localhost`];
			const projectDomains = await listDomains(id);
			const verified = projectDomains.filter(d => d.validationStatus === 'verified');
			for (const d of verified) {
				domains.push(d.domain);
			}

			const regexEscaped = domains.map(d => d.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\\\$&')).join('|');
			const queryStr = `{container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$"`;

			const startParam = (queryParams as any)?.start;
			const endParam = (queryParams as any)?.end;

			let startNs = "";
			if (startParam) {
				startNs = `${Number(startParam) * 1000000}`;
			} else {
				// Default to 7 days ago in nanoseconds
				startNs = `${(Date.now() - 7 * 24 * 60 * 60 * 1000) * 1000000}`;
			}

			let endNs = "";
			if (endParam) {
				endNs = `${Number(endParam) * 1000000}`;
			} else {
				endNs = `${Date.now() * 1000000}`;
			}

			let url = `http://loki:3100/loki/api/v1/query_range?query=${encodeURIComponent(queryStr)}&limit=1000`;
			if (startNs) url += `&start=${startNs}`;
			if (endNs) url += `&end=${endNs}`;

			try {
				const response = await fetch(url);
				if (!response.ok) {
					return [];
				}
				const data = (await response.json()) as any;
				if (data.status !== "success" || !data.data?.result) {
					return [];
				}

				const logs: any[] = [];
				for (const streamObj of data.data.result) {
					for (const [ts, val] of streamObj.values) {
						try {
							const sequence = Number(ts);
							logs.push({
								id: `req-${ts}`,
								sequence,
								stage: "system" as const,
								message: val,
								createdAt: new Date(Number(ts) / 1000000).toISOString(),
							});
						} catch {}
					}
				}

				logs.sort((a, b) => b.sequence - a.sequence);
				return logs;
			} catch (e) {
				console.error("Failed to fetch request logs from Loki:", e);
				return [];
			}
		}
	)
	.get(
		"/projects/:id/metrics/requests",
		async ({ params: { id }, set }) => {
			const project = await getProjectById(id);
			if (!project) {
				set.status = 404;
				return { error: "Project not found" };
			}
			const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);
			const slug = slugify(project.name);
			const domains = [`${slug}.localhost`];
			const projectDomains = await listDomains(id);
			const verified = projectDomains.filter(d => d.validationStatus === 'verified');
			for (const d of verified) {
				domains.push(d.domain);
			}

			const regexEscaped = domains.map(d => d.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\\\$&')).join('|');
			
			// Loki metric query for request rate
			const query = `sum(count_over_time({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" [5m]))`;
			
			const end = Math.floor(Date.now() / 1000);
			const start = end - (6 * 60 * 60); // 6 hours ago
			const step = "60s"; // 1 min resolution
			
			try {
				const response = await fetch(
					`http://loki:3100/loki/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`
				);
				const data = await response.json() as any;
				if (data.status === "success" && data.data?.result?.[0]?.values) {
					return {
						status: "success",
						data: {
							resultType: "matrix",
							result: [
								{
									metric: {},
									values: data.data.result[0].values
								}
							]
						}
					};
				}
				return { status: "success", data: { resultType: "matrix", result: [] } };
			} catch (e) {
				console.error("Loki query failed", e);
				return { status: "success", data: { resultType: "matrix", result: [] } };
			}
		}
	)
	.get(
		"/projects/:id/request-logs/stream",
		async ({ params: { id }, request, set }) => {
			const project = await getProjectById(id);
			if (!project) {
				set.status = 404;
				return { error: "Project not found" };
			}
			const encoder = new TextEncoder();
			const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);
			const slug = slugify(project.name);
			const domains = [`${slug}.localhost`];
			const projectDomains = await listDomains(id);
			const verified = projectDomains.filter(d => d.validationStatus === 'verified');
			for (const d of verified) {
				domains.push(d.domain);
			}

			const regexEscaped = domains.map(d => d.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\\\$&')).join('|');
			const query = `{container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$"`;

			let ws: WebSocket | null = null;
			let closed = false;
			let heartbeat: ReturnType<typeof setInterval> | null = null;

			const stop = () => {
				if (closed) return;
				closed = true;
				if (heartbeat) clearInterval(heartbeat);
				if (ws) {
					try {
						ws.close();
					} catch {}
				}
			};

			request.signal.addEventListener("abort", stop, { once: true });

			const stream = new ReadableStream({
				async start(controller) {
					const send = (eventName: string, payload: unknown) => {
						if (closed) return;
						controller.enqueue(
							encoder.encode(
								`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`
							)
						);
					};

					send("ready", { projectId: id });

					heartbeat = setInterval(() => {
						send("heartbeat", { at: new Date().toISOString() });
					}, 15000);

					const startNs = BigInt(Date.now() - 5000) * 1000000n;
					const url = `ws://loki:3100/loki/api/v1/tail?query=${encodeURIComponent(query)}&start=${startNs.toString()}`;

					try {
						ws = new WebSocket(url);

						ws.onmessage = (event) => {
							if (closed) return;
							try {
								const dataStr = typeof event.data === "string" 
									? event.data 
									: new TextDecoder().decode(event.data as any);
								const data = JSON.parse(dataStr) as any;
								if (data.streams) {
									const newLogs: any[] = [];
									for (const streamObj of data.streams) {
										for (const [ts, val] of streamObj.values) {
											const tsBig = BigInt(ts);
											newLogs.push({
												id: `req-${ts}`,
												sequence: Number(ts),
												stage: "system" as const,
												message: val,
												createdAt: new Date(Number(tsBig / 1000000n)).toISOString(),
											});
										}
									}
									newLogs.sort((a, b) => a.sequence - b.sequence);
									for (const log of newLogs) {
										send("log", log);
									}
								}
							} catch (e) {
								console.error("Loki WS parse error:", e);
							}
						};

						ws.onerror = (err) => {
							console.error("Loki WS error:", err);
						};

						ws.onclose = () => {
							if (!closed) {
								stop();
								try {
									controller.close();
								} catch {}
							}
						};
					} catch (e) {
						console.error("Failed to establish Loki WebSocket connection:", e);
						stop();
						try {
							controller.close();
						} catch {}
					}
				},
				cancel: stop,
			});

			set.headers["content-type"] = "text/event-stream";
			return new Response(stream, {
				headers: {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache, no-transform",
					"Connection": "keep-alive",
					"X-Accel-Buffering": "no",
				}
			});
		}
	);
