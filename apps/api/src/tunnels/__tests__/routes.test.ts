import { describe, expect, it } from "bun:test";
import { ipInCidr, resolveGatewayRoute, type RouteRow } from "../routes";

const ROW: RouteRow = {
	internalHost: "db-abc123",
	internalPort: 5432,
	status: "running",
	publicAccess: true,
	allowAnywhere: false,
	allowedCidrs: [],
};

const ctxFor = (row: RouteRow | null, overrides: Partial<{ remoteAddress: string; baseDomain: string }> = {}) => ({
	baseDomain: overrides.baseDomain ?? "db.example.com",
	remoteAddress: overrides.remoteAddress ?? "203.0.113.9",
	lookup: async () => row,
});

describe("ipInCidr", () => {
	it("matches prefixes and rejects others", () => {
		expect(ipInCidr("10.0.0.5", "10.0.0.0/24")).toBe(true);
		expect(ipInCidr("10.0.1.5", "10.0.0.0/24")).toBe(false);
		expect(ipInCidr("192.168.1.7", "192.168.1.7/32")).toBe(true);
		expect(ipInCidr("::ffff:10.0.0.5", "10.0.0.0/8")).toBe(true);
		expect(ipInCidr("10.0.0.5", "garbage")).toBe(false);
		expect(ipInCidr("not-an-ip", "10.0.0.0/8")).toBe(false);
		expect(ipInCidr("10.0.0.5", "10.0.0.0/0")).toBe(true);
	});
});

describe("resolveGatewayRoute", () => {
	it("routes a running exposed database to its engine", async () => {
		const route = await resolveGatewayRoute("db-abc123.db.example.com", ctxFor(ROW));
		expect(route).toEqual({ kind: "engine", host: "db-abc123", port: 5432 });
	});

	it("falls back to caddy for non-database or wrong-domain hostnames", async () => {
		const ctx = ctxFor(ROW);
		expect(await resolveGatewayRoute(null, ctx)).toEqual({ kind: "caddy" });
		expect(await resolveGatewayRoute("app.example.com", ctx)).toEqual({ kind: "caddy" });
		expect(await resolveGatewayRoute("db-abc123.other.com", ctx)).toEqual({ kind: "caddy" });
		expect(await resolveGatewayRoute("evil.db.example.com", ctx)).toEqual({ kind: "caddy" });
		expect(await resolveGatewayRoute("db-abc123.db.example.com", ctxFor(ROW, { baseDomain: "localhost" }))).toEqual({
			kind: "caddy",
		});
	});

	it("falls back to caddy when the database is unknown, not running, or not exposed", async () => {
		expect(await resolveGatewayRoute("db-abc123.db.example.com", ctxFor(null))).toEqual({ kind: "caddy" });
		expect(await resolveGatewayRoute("db-abc123.db.example.com", ctxFor({ ...ROW, status: "stopped" }))).toEqual({
			kind: "caddy",
		});
		expect(await resolveGatewayRoute("db-abc123.db.example.com", ctxFor({ ...ROW, publicAccess: false }))).toEqual({
			kind: "caddy",
		});
	});

	it("enforces allowed CIDRs only when configured", async () => {
		const cidrRow: RouteRow = { ...ROW, allowedCidrs: ["198.51.100.0/24"] };
		expect(
			await resolveGatewayRoute("db-abc123.db.example.com", ctxFor(cidrRow, { remoteAddress: "198.51.100.4" })),
		).toEqual({ kind: "engine", host: "db-abc123", port: 5432 });
		expect(
			await resolveGatewayRoute("db-abc123.db.example.com", ctxFor(cidrRow, { remoteAddress: "203.0.113.9" })),
		).toEqual({ kind: "caddy" });
		const anywhereRow: RouteRow = { ...ROW, allowedCidrs: [], allowAnywhere: true };
		expect(await resolveGatewayRoute("db-abc123.db.example.com", ctxFor(anywhereRow))).toEqual({
			kind: "engine",
			host: "db-abc123",
			port: 5432,
		});
	});
});
