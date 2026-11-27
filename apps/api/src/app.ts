import { cors } from "@elysiajs/cors";
import { count, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { apiRoutes } from "./api";
import { getDb } from "./db/db-provider";
import { deployments } from "./db/schema";

const metrics = {
	requestsTotal: 0,
	activeDeployments: 0,
	uptime: Date.now(),
};

const renderMetrics = async () => {
	const db = await getDb();
	const [result] = await db.select({ count: count() }).from(deployments).where(eq(deployments.status, "running"));
	metrics.activeDeployments = Number(result?.count ?? 0);
	const uptimeSec = Math.floor((Date.now() - metrics.uptime) / 1000);
	return `# HELP dequl_requests_total Total API requests
# TYPE dequl_requests_total counter
dequl_requests_total ${metrics.requestsTotal}
# HELP dequl_active_deployments Currently running deployments
# TYPE dequl_active_deployments gauge
dequl_active_deployments ${metrics.activeDeployments}
# HELP dequl_uptime_seconds API uptime in seconds
# TYPE dequl_uptime_seconds counter
dequl_uptime_seconds ${uptimeSec}
`;
};

export const app = new Elysia()
	.use(
		cors({
			origin: () => true,
			credentials: false,
		}),
	)
	.onBeforeHandle(() => {
		metrics.requestsTotal++;
	})
	.use(apiRoutes)
	.get("/", () => ({ service: "dequl-api", ok: true }))
	.get("/metrics", renderMetrics)
	.get("/api/metrics", renderMetrics);
