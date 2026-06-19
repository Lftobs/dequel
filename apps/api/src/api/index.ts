import { Elysia } from "elysia";
import { alertsRoutes } from "./alerts";
import { apiKeysRoutes } from "./api-keys";
import { databasesRoutes } from "./databases";
import { deploymentsRoutes } from "./deployments";
import { domainsRoutes } from "./domains";
import { envVarsRoutes } from "./env-vars";
import { githubRoutes } from "./github";
import { healthRoutes } from "./health";
import { projectsRoutes } from "./projects";
import { prometheusRoutes } from "./prometheus";
import { scalingRoutes } from "./scaling";
import { serverInfoRoutes } from "./server-info";
import { serversRoutes } from "./servers";
import { volumesRoutes } from "./volumes";
import { settingsRoutes } from "./settings";

const authMiddleware = (app: Elysia) =>
	app.onBeforeHandle(async ({ request, set }) => {
		const authHeader = request.headers.get(
			"authorization",
		);
		if (!authHeader?.startsWith("Bearer "))
			return;
		const token = authHeader.slice(7);
		if (!token) return;
		const { validateApiKey } =
			await import("../db/repo");
		const key = await validateApiKey(token);
		if (!key) {
			set.status = 401;
			return { error: "Invalid API key" };
		}
	});

export const apiRoutes = new Elysia({
	prefix: "/api",
})
	.use(authMiddleware)
	.use(healthRoutes)
	.use(projectsRoutes)
	.use(deploymentsRoutes)
	.use(envVarsRoutes)
	.use(volumesRoutes)
	.use(databasesRoutes)
	.use(domainsRoutes)
	.use(scalingRoutes)
	.use(serversRoutes)
	.use(serverInfoRoutes)
	.use(apiKeysRoutes)
	.use(prometheusRoutes)
	.use(alertsRoutes)
	.use(githubRoutes)
	.use(settingsRoutes);
