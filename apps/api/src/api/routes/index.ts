import { Elysia } from "elysia";
import { ok } from "../response";
import { listRoutes } from "../../db/repo";

export const routesRoutes = new Elysia()
	.get("/routes", async ({ query }) => {
		const serverId = typeof query?.serverId === "string" ? query.serverId : undefined;
		return ok({ routes: await listRoutes(serverId) });
	});
