import { Elysia } from "elysia";
import { listRoutes } from "../db/repo";

export const routesRoutes = new Elysia()
	.get("/routes", async ({ query }) => {
		const serverId = typeof query?.serverId === "string" ? query.serverId : undefined;
		return { routes: await listRoutes(serverId) };
	});