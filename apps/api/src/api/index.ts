import { Elysia } from "elysia";
import { fixdiagRoutes } from "../fixdiag/routes";
import { agentRoutes } from "./agents";
import { alertsRoutes } from "./alerts";
import { apiKeysRoutes } from "./api-keys";
import { authRoutes } from "./auth";
import { authMiddleware } from "./auth-middleware";
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
import { fail } from "./response";
import { routesRoutes } from "./routes";
import { scalingRoutes } from "./scaling";
import { serverInfoRoutes } from "./server-info";
import { serversRoutes } from "./servers";
import { settingsRoutes } from "./settings";
import { llmSettingsRoutes } from "./settings/llm";
import { sharedEnvLinksRoutes, sharedEnvVarsRoutes } from "./shared-env-vars";
import { sshKeysRoutes } from "./ssh-keys";
import { volumesRoutes } from "./volumes";

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
	.use(llmSettingsRoutes)
	.use(fixdiagRoutes)
	.use(routesRoutes)
	.use(backupRoutes);
