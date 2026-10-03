import type { HealthCheck, OverallHealth } from "../types";

const SERVER_HEARTBEAT_FAIL_MS = 90_000;
const HTTP_ERROR_RATE_WARN = 0.05;

export const evaluateHealth = (input: {
	server: { status: string; lastHeartbeatAgeMs: number | null } | null;
	runningDeployments: number;
	hasDeployments: boolean;
	routeErrors: string[];
	http: { available: boolean; errorRate: number | null };
}): { overall: OverallHealth; checks: HealthCheck[] } => {
	const checks: HealthCheck[] = [];

	if (!input.server) {
		checks.push({ name: "server", status: "ok", detail: null });
	} else if (input.server.lastHeartbeatAgeMs === null) {
		checks.push({ name: "server", status: "fail", detail: "Server never heartbeated" });
	} else if (input.server.lastHeartbeatAgeMs > SERVER_HEARTBEAT_FAIL_MS) {
		checks.push({
			name: "server",
			status: "fail",
			detail: `Heartbeat stale for ${Math.round(input.server.lastHeartbeatAgeMs / 1000)}s`,
		});
	} else {
		checks.push({ name: "server", status: "ok", detail: null });
	}

	if (!input.hasDeployments) {
		checks.push({ name: "containers", status: "warn", detail: "No deployments yet" });
	} else if (input.runningDeployments === 0) {
		checks.push({ name: "containers", status: "fail", detail: "No running containers" });
	} else {
		checks.push({
			name: "containers",
			status: "ok",
			detail: `${input.runningDeployments} running`,
		});
	}

	if (input.routeErrors.length > 0) {
		checks.push({ name: "ingress", status: "warn", detail: input.routeErrors[0] });
	} else {
		checks.push({ name: "ingress", status: "ok", detail: null });
	}

	if (!input.http.available) {
		checks.push({ name: "http", status: "unknown", detail: "Loki unavailable" });
	} else if (input.http.errorRate === null) {
		checks.push({ name: "http", status: "unknown", detail: "No traffic" });
	} else if (input.http.errorRate > HTTP_ERROR_RATE_WARN) {
		checks.push({
			name: "http",
			status: "warn",
			detail: `${(input.http.errorRate * 100).toFixed(1)}% error rate`,
		});
	} else {
		checks.push({ name: "http", status: "ok", detail: null });
	}

	let overall: OverallHealth = "healthy";
	if (checks.some((c) => c.status === "fail")) overall = "down";
	else if (checks.some((c) => c.status === "warn" || c.status === "unknown")) overall = "degraded";

	return { overall, checks };
};
