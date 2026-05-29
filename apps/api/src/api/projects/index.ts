import { Elysia } from "elysia";
import {
	createProject,
	deleteProject,
	getProjectById,
	listProjects,
	updateProject,
	listDomains,
} from "../../db/repo";

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
			return createProject({
				name: body.name,
				description: body.description,
				baseDomain: body.baseDomain,
				repoUrl: body.repoUrl,
				repoBranch: body.repoBranch,
				cpuLimit: body.cpuLimit,
				memoryLimitMb: body.memoryLimitMb,
			});
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
			const ok = await deleteProject(id);
			if (!ok) {
				set.status = 404;
				return { error: "Project not found" };
			}
			return { ok: true };
		},
	)
	.get(
		"/projects/:id/request-logs",
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

			const regexEscaped = domains.map(d => d.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
			const query = `{container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$"`;

			try {
				const response = await fetch(
					`http://loki:3100/loki/api/v1/query_range?query=${encodeURIComponent(query)}&limit=250`
				);
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

				logs.sort((a, b) => a.sequence - b.sequence);
				return logs;
			} catch (e) {
				console.error("Failed to fetch request logs from Loki:", e);
				return [];
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

			const regexEscaped = domains.map(d => d.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
			const query = `{container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$"`;

			let closed = false;
			request.signal.addEventListener("abort", () => {
				closed = true;
			});

			return new Response(
				new ReadableStream({
					async start(controller) {
						const send = (eventName: string, payload: unknown) => {
							if (closed) return;
							controller.enqueue(
								encoder.encode(
									`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`
								)
							);
						};

						let lastSeenNs = Date.now() * 1000000;

						while (!closed) {
							try {
								const response = await fetch(
									`http://loki:3100/loki/api/v1/query_range?query=${encodeURIComponent(query)}&start=${lastSeenNs + 1}&limit=50`
								);
								if (response.ok) {
									const data = await response.json() as any;
									if (data.status === "success" && data.data?.result) {
										const newLogs: any[] = [];
										for (const streamObj of data.data.result) {
											for (const [ts, val] of streamObj.values) {
												const tsNum = Number(ts);
												if (tsNum > lastSeenNs) {
													newLogs.push({
														id: `req-${ts}`,
														sequence: tsNum,
														stage: "system" as const,
														message: val,
														createdAt: new Date(tsNum / 1000000).toISOString(),
													});
													if (tsNum > lastSeenNs) {
														lastSeenNs = tsNum;
													}
												}
											}
										}
										newLogs.sort((a, b) => a.sequence - b.sequence);
										for (const log of newLogs) {
											send("log", log);
										}
									}
								}
							} catch (e) {
								console.error("Loki stream error:", e);
							}
							await new Promise((resolve) => setTimeout(resolve, 2000));
						}
						controller.close();
					}
				}),
				{
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						Connection: "keep-alive",
					}
				}
			);
		}
	);
