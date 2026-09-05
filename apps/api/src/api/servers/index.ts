import { Elysia } from "elysia";
import { createServer, deleteServer, getServerById, listServers } from "../../db/repo";
import { serverEventBus } from "../../servers/event-bus";
import { isServerPreparing, prepareServer } from "../../servers/prepare";
import { testSshConnection } from "../../utils/ssh";
import { isPort, SERVER_HOST_RE } from "../../utils/validate";
import { created, fail, ok } from "../response";

export const serversRoutes = new Elysia()
	.get("/servers", async () => ok(await listServers()))
	.post("/servers", async ({ body, set }: any) => {
		if (!body?.name || !body?.host) {
			set.status = 400;
			return fail("name and host are required");
		}
		if (!SERVER_HOST_RE.test(body.host)) {
			set.status = 400;
			return fail("host must be a valid hostname or IP address");
		}
		if (body.mode && body.mode !== "ssh" && body.mode !== "agent") {
			set.status = 400;
			return fail("mode must be 'ssh' or 'agent'");
		}
		if (body.port !== undefined && body.port !== null && !isPort(Number(body.port))) {
			set.status = 400;
			return fail("port must be between 1 and 65535");
		}
		return created(
			await createServer({
				name: body.name,
				host: body.host,
				port: body.port ? Number(body.port) : body.mode === "ssh" ? 22 : 2375,
				mode: body.mode ?? "ssh",
				sshUser: body.sshUser ?? "root",
				sshKey: body.sshKey,
				sshKeyId: body.sshKeyId,
				sshPassword: body.sshPassword,
				authToken: body.authToken,
			}),
		);
	})
	.get("/servers/:id", async ({ params: { id }, set }) => {
		const server = await getServerById(id);
		if (!server) {
			set.status = 404;
			return fail("Server not found");
		}
		return ok(server);
	})
	.get("/servers/:id/stats", async ({ params: { id }, set }) => {
		const server = await getServerById(id);
		if (!server) {
			set.status = 404;
			return fail("Server not found");
		}
		const containers =
			server.mode === "agent"
				? [...(await (await import("../../agents/stats-cache")).agentStatsCache.get(id)).values()]
				: [];
		const online =
			server.mode === "agent"
				? !!server.lastHeartbeat && Date.now() - new Date(server.lastHeartbeat).getTime() <= 90_000
				: server.status === "connected";
		return ok({
			serverId: id,
			mode: server.mode,
			online,
			lastHeartbeat: server.lastHeartbeat,
			resources: {
				cpuUsedPercent: server.cpuUsedPercent,
				memoryUsedMb: server.memoryUsedMb,
				cpuTotal: server.cpuTotal,
				memoryTotalMb: server.memoryTotalMb,
			},
			containers,
		});
	})
	.post("/servers/:id/prepare", async ({ params: { id }, set }) => {
		const server = await getServerById(id);
		if (!server) {
			set.status = 404;
			return fail("Server not found");
		}
		if (isServerPreparing(id)) {
			set.status = 409;
			return fail("Server preparation is already running");
		}
		if (server.mode !== "ssh" && server.mode !== "agent") {
			set.status = 400;
			return fail("Only ssh and agent servers can be prepared");
		}
		serverEventBus.clear(id);
		prepareServer(server, (stage, message, done, ok, error) => {
			serverEventBus.publish({ serverId: id, stage, message, done: done ?? false, ok: ok ?? false, error });
		});
		return ok({ preparing: true }, "Server preparation started");
	})
	.get("/servers/:id/prepare/stream", async ({ params: { id }, request, set }) => {
		const server = await getServerById(id);
		if (!server) {
			set.status = 404;
			return fail("Server not found");
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
				const finish = () => {
					stop();
					try {
						controller.close();
					} catch {}
				};
				const lastEvent = serverEventBus.getLastEvent(id);
				if (lastEvent) {
					send(lastEvent.done ? "done" : "log", lastEvent);
					if (lastEvent.done) {
						finish();
						return;
					}
				} else {
					send("ready", { serverId: id, preparing: isServerPreparing(id) });
				}
				unsubscribe = serverEventBus.subscribe(id, (event) => {
					send(event.done ? "done" : "log", event);
					if (event.done) finish();
				});
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
	.post("/servers/:id/test", async ({ params: { id }, set }) => {
		const server = await getServerById(id);
		if (!server) {
			set.status = 404;
			return fail("Server not found");
		}
		if (server.mode === "ssh") {
			const passed = await testSshConnection(server);
			return ok({ ok: passed, mode: "ssh" });
		}
		return ok({ ok: server.status === "connected", mode: server.mode });
	})
	.delete("/servers/:id", async ({ params: { id }, set }) => {
		const deleted = await deleteServer(id);
		if (!deleted) {
			set.status = 404;
			return fail("Server not found");
		}
		return ok(null, "Server deleted");
	});
