import { Elysia } from "elysia";
import { listRoutes } from "../../db/repo";
import { ok } from "../response";

export const routesRoutes = new Elysia().get("/routes", async ({ query }) => {
	const serverId = typeof query?.serverId === "string" ? query.serverId : undefined;
	return ok({ routes: await listRoutes(serverId) });
});
