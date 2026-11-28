import { describe, expect, test } from "bun:test";
import { buildHealthCheckArgs, buildRestartArgs } from "../health";

describe("buildHealthCheckArgs", () => {
	test("returns no flags for none or missing checks", () => {
		expect(buildHealthCheckArgs(null, 3000)).toEqual([]);
		expect(buildHealthCheckArgs({ type: "none" }, 3000)).toEqual([]);
	});

	test("builds an http health check using the app port by default", () => {
		const args = buildHealthCheckArgs({ type: "http", path: "healthz" }, 8080);
		expect(args).toContain("--health-cmd");
		expect(args.join(" ")).toContain("http://127.0.0.1:8080/healthz");
		expect(args).toContain("--health-interval");
		expect(args).toContain("10s");
		expect(args).toContain("--health-retries");
		expect(args).toContain("3");
	});

	test("honours a custom health port and timings", () => {
		const args = buildHealthCheckArgs(
			{
				type: "tcp",
				port: 9090,
				intervalSeconds: 15,
				timeoutSeconds: 4,
				startPeriodSeconds: 20,
				retries: 5,
			},
			3000,
		);
		expect(args.join(" ")).toContain("127.0.0.1 9090");
		expect(args.join(" ")).toContain("--health-interval 15s");
		expect(args.join(" ")).toContain("--health-timeout 4s");
		expect(args.join(" ")).toContain("--health-start-period 20s");
		expect(args.join(" ")).toContain("--health-retries 5");
	});

	test("uses an explicit command for command checks", () => {
		const args = buildHealthCheckArgs({ type: "command", command: "curl -fsS localhost:3000" }, 3000);
		expect(args.join(" ")).toContain("curl -fsS localhost:3000");
	});

	test("does not emit a command without a command value", () => {
		expect(buildHealthCheckArgs({ type: "command", command: " " }, 3000)).toEqual([]);
	});
});

describe("buildRestartArgs", () => {
	test("maps Docker restart policies", () => {
		expect(buildRestartArgs("unless-stopped", null, null)).toEqual(["--restart", "unless-stopped"]);
		expect(buildRestartArgs("always", null, null)).toEqual(["--restart", "always"]);
		expect(buildRestartArgs("no", null, null)).toEqual([]);
	});

	test("appends max retries for on-failure", () => {
		expect(buildRestartArgs("on-failure", 5, null)).toEqual(["--restart", "on-failure:5"]);
		expect(buildRestartArgs("on-failure", null, null)).toEqual(["--restart", "on-failure"]);
	});

	test("adds a stop timeout when provided", () => {
		expect(buildRestartArgs("always", null, 30)).toEqual(["--restart", "always", "--stop-timeout", "30"]);
		expect(buildRestartArgs(null, null, 0)).toEqual(["--stop-timeout", "0"]);
	});
});
