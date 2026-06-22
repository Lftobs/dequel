import { Elysia } from "elysia";
import { alertsRoutes } from "./alerts";
import { apiKeysRoutes } from "./api-keys";
import { authRoutes } from "./auth";
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

const BYPASS_PATHS = new Set(["/api/auth/login", "/api/auth/logout", "/api/auth/refresh", "/api/auth/me", "/api/health"]);

const authMiddleware = (app: Elysia) =>
	app.onBeforeHandle(async ({ request, set, path }) => {
		if (BYPASS_PATHS.has(path)) return;

		const cookie = request.headers.get("cookie") || "";
		const match = cookie.match(/(?:^|;\s*)dequel_session=([^;]+)/);
		if (match) {
			const { verifyAccessToken } = await import("../utils/auth");
			const payload = await verifyAccessToken(match[1]);
			if (payload) return;
			set.status = 401;
			return { error: "Invalid session" };
		}

		const authHeader = request.headers.get("authorization");
		if (authHeader?.startsWith("Bearer ")) {
			const token = authHeader.slice(7);
			if (token) {
				const { validateApiKey } = await import("../db/repo");
				const key = await validateApiKey(token);
				if (key) return;
				set.status = 401;
				return { error: "Invalid API key" };
			}
		}

		set.status = 401;
		return { error: "Authentication required" };
	});

export const apiRoutes = new Elysia({
	prefix: "/api",
})
	.use(authRoutes)
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
