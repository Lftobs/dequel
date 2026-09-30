import { Elysia } from "elysia";
import { fail } from "./response";
import { agentRoutes } from "./agents";
import { alertsRoutes } from "./alerts";
import { apiKeysRoutes } from "./api-keys";
import { authRoutes } from "./auth";
import { backupRoutes } from "./backups";
import { databasesRoutes } from "./databases";
import { deploymentsRoutes } from "./deployments";
import { domainsRoutes } from "./domains";
import { envVarsRoutes } from "./env-vars";
import { githubRoutes } from "./github";
import { healthRoutes } from "./health";
import { projectsRoutes } from "./projects";
import { projectStatusRoutes } from "./projects/status";
import { prometheusRoutes } from "./prometheus";
import { routesRoutes } from "./routes";
import { scalingRoutes } from "./scaling";
import { serverInfoRoutes } from "./server-info";
import { serversRoutes } from "./servers";
import { settingsRoutes } from "./settings";
import { sharedEnvLinksRoutes, sharedEnvVarsRoutes } from "./shared-env-vars";
import { sshKeysRoutes } from "./ssh-keys";
import { volumesRoutes } from "./volumes";

const BYPASS_PATHS = new Set([
	"/api/auth/login",
	"/api/auth/logout",
	"/api/auth/refresh",
	"/api/auth/me",
	"/api/health",
	"/api/github/callback",
	"/api/github/webhook",
	"/api/agents/register",
	"/api/agents/p2p-sync",
]);

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
			return fail("Invalid session");
		}

		const authHeader = request.headers.get("authorization");
		if (authHeader?.startsWith("Bearer ")) {
			const token = authHeader.slice(7);
			if (token) {
				const { validateApiKey } = await import("../db/repo");
				const key = await validateApiKey(token);
				if (key) return;
				set.status = 401;
				return fail("Invalid API key");
			}
		}

		set.status = 401;
		return fail("Authentication required");
	});

const INTERNAL_ERROR =
	/Failed query:|params:|getaddrinfo|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|EHOSTUNREACH|timeout exceeded|node:internal|Cannot read propert|is not a function|is not a constructor|Unexpected token/i;

import { captureTelemetry } from "../utils/telemetry";

export const apiRoutes = new Elysia({
	prefix: "/api",
})
	.onError(({ error, set, path }) => {
		const err = error as { status?: number; message?: string; name?: string };
		set.status = typeof err?.status === "number" ? err.status : 500;
		const message = err?.message ?? "Internal server error";

		if (set.status >= 500) {
			captureTelemetry("server_error", {
				path,
				status: set.status,
				error_name: err?.name || "UnhandledServerError",
			}).catch(() => {});
		}

		if (set.status >= 500 || INTERNAL_ERROR.test(message)) {
			console.error("[API] Unhandled error:", error);
			return fail("Internal server error");
		}
		return fail(message);
	})
	.use(authRoutes)
	.use(authMiddleware)
	.use(agentRoutes)
	.use(healthRoutes)
	.use(projectsRoutes)
	.use(projectStatusRoutes)
	.use(deploymentsRoutes)
	.use(envVarsRoutes)
	.use(sharedEnvVarsRoutes)
	.use(sharedEnvLinksRoutes)
	.use(sshKeysRoutes)
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
	.use(settingsRoutes)
	.use(routesRoutes)
	.use(backupRoutes);
