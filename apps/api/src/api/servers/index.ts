import { Elysia } from "elysia";
import {
	createServer,
	deleteServer,
	getServerById,
	listServers,
} from "../../db/repo";
import { testSshConnection } from "../../utils/ssh";

export const serversRoutes = new Elysia()
	.get("/servers", async () => listServers())
	.post(
		"/servers",
		async ({ body, set }: any) => {
			if (!body?.name || !body?.host) {
				set.status = 400;
				return {
					error: "name and host are required",
				};
			}
			return createServer({
				name: body.name,
				host: body.host,
				port: body.port ?? (body.mode === "ssh" ? 22 : 2375),
				mode: body.mode ?? "ssh",
				sshUser: body.sshUser ?? "root",
				sshKey: body.sshKey,
				sshPassword: body.sshPassword,
				authToken: body.authToken,
			});
		},
	)
	.get(
		"/servers/:id",
		async ({ params: { id }, set }) => {
			const server = await getServerById(id);
			if (!server) {
				set.status = 404;
				return { error: "Server not found" };
			}
			return server;
		},
	)
	.post(
		"/servers/:id/test",
		async ({ params: { id }, set }) => {
			const server = await getServerById(id);
			if (!server) {
				set.status = 404;
				return { error: "Server not found" };
			}
			if (server.mode === "ssh") {
				const ok = await testSshConnection(server);
				return { ok, mode: "ssh" };
			}
			return { ok: server.status === "connected", mode: server.mode };
		},
	)
	.delete(
		"/servers/:id",
		async ({ params: { id }, set }) => {
			const ok = await deleteServer(id);
			if (!ok) {
				set.status = 404;
				return { error: "Server not found" };
			}
			return { ok: true };
		},
	);
