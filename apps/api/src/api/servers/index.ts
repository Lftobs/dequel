import { Elysia } from "elysia";
import {
	createServer,
	deleteServer,
	getServerById,
	listServers,
} from "../../db/repo";

export const serversRoutes = new Elysia()
	.get("/servers", async () => listServers())
	.post(
		"/servers",
		async ({ body, set }: any) => {
			if (!body?.name || !body?.host || !body?.authToken) {
				set.status = 400;
				return {
					error: "name, host, and authToken are required",
				};
			}
			return createServer({
				name: body.name,
				host: body.host,
				port: body.port,
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
