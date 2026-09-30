import { describe, expect, it } from "bun:test";
import { evaluateHealth } from "../health";

const base = {
	server: null as { status: string; lastHeartbeatAgeMs: number | null } | null,
	runningDeployments: 1,
	hasDeployments: true,
	routeErrors: [] as string[],
	http: { available: true, errorRate: 0 },
};

const check = (result: ReturnType<typeof evaluateHealth>, name: string) => result.checks.find((c) => c.name === name)!;

describe("evaluateHealth", () => {
	it("is healthy when everything is fine locally", () => {
		const result = evaluateHealth(base);
		expect(result.overall).toBe("healthy");
		expect(result.checks).toHaveLength(4);
		expect(check(result, "server").status).toBe("ok");
		expect(check(result, "containers").status).toBe("ok");
		expect(check(result, "ingress").status).toBe("ok");
		expect(check(result, "http").status).toBe("ok");
	});

	it("treats a missing server row as local ok", () => {
		const result = evaluateHealth({ ...base, server: null });
		expect(check(result, "server").status).toBe("ok");
	});

	it("fails on a stale remote heartbeat", () => {
		const result = evaluateHealth({ ...base, server: { status: "connected", lastHeartbeatAgeMs: 120_000 } });
		expect(check(result, "server").status).toBe("fail");
		expect(check(result, "server").detail).toContain("Heartbeat stale");
		expect(result.overall).toBe("down");
	});

	it("fails when a server never heartbeated", () => {
		const result = evaluateHealth({ ...base, server: { status: "pending", lastHeartbeatAgeMs: null } });
		expect(check(result, "server").status).toBe("fail");
		expect(result.overall).toBe("down");
	});

	it("passes on a fresh heartbeat", () => {
		const result = evaluateHealth({ ...base, server: { status: "connected", lastHeartbeatAgeMs: 5_000 } });
		expect(check(result, "server").status).toBe("ok");
	});

	it("warns when there are no deployments yet", () => {
		const result = evaluateHealth({ ...base, hasDeployments: false, runningDeployments: 0 });
		expect(check(result, "containers").status).toBe("warn");
		expect(check(result, "containers").detail).toBe("No deployments yet");
		expect(result.overall).toBe("degraded");
	});

	it("fails when deployments exist but none are running", () => {
		const result = evaluateHealth({ ...base, runningDeployments: 0 });
		expect(check(result, "containers").status).toBe("fail");
		expect(result.overall).toBe("down");
	});

	it("warns on route errors with the first error as detail", () => {
		const result = evaluateHealth({ ...base, routeErrors: ["upstream unreachable", "second"] });
		expect(check(result, "ingress").status).toBe("warn");
		expect(check(result, "ingress").detail).toBe("upstream unreachable");
		expect(result.overall).toBe("degraded");
	});

	it("is unknown when Loki is unavailable", () => {
		const result = evaluateHealth({ ...base, http: { available: false, errorRate: null } });
		expect(check(result, "http").status).toBe("unknown");
		expect(check(result, "http").detail).toBe("Loki unavailable");
		expect(result.overall).toBe("degraded");
	});

	it("is unknown when there is no traffic", () => {
		const result = evaluateHealth({ ...base, http: { available: true, errorRate: null } });
		expect(check(result, "http").status).toBe("unknown");
		expect(check(result, "http").detail).toBe("No traffic");
		expect(result.overall).toBe("degraded");
	});

	it("warns above a 5% error rate", () => {
		const result = evaluateHealth({ ...base, http: { available: true, errorRate: 0.06 } });
		expect(check(result, "http").status).toBe("warn");
		expect(check(result, "http").detail).toBe("6.0% error rate");
		expect(result.overall).toBe("degraded");
	});

	it("stays ok at or below a 5% error rate", () => {
		const result = evaluateHealth({ ...base, http: { available: true, errorRate: 0.05 } });
		expect(check(result, "http").status).toBe("ok");
		expect(result.overall).toBe("healthy");
	});

	it("lets fail win over warn for overall status", () => {
		const result = evaluateHealth({
			...base,
			runningDeployments: 0,
			routeErrors: ["broken"],
			http: { available: true, errorRate: 0.5 },
		});
		expect(result.overall).toBe("down");
	});
});
