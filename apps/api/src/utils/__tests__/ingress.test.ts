import { describe, expect, it, mock } from "bun:test";
import { ingressSite, projectServerSite, shouldRouteViaIngress } from "../ingress";

describe("ingress route shapes", () => {
	it("writes a :80 listener site when the project server is behind the ingress", () => {
		const snippet = projectServerSite("app.example.com", 3000, ["deploy-dep-1"], true);
		expect(snippet).toContain(":80 {");
		expect(snippet).toContain("reverse_proxy deploy-dep-1:3000");
	});

	it("keeps the TLS site when no ingress is used", () => {
		const snippet = projectServerSite("app.example.com", 3000, ["deploy-dep-1"], false);
		expect(snippet.startsWith("app.example.com {")).toBe(true);
		expect(snippet).not.toContain("http://");
	});

	it("writes an ingress proxy site to the upstream host with pass-through Host", () => {
		const snippet = ingressSite("app.example.com", "203.0.113.10");
		expect(snippet).toContain("reverse_proxy 203.0.113.10:80");
		expect(snippet).not.toContain("header_up Host");
	});
});

describe("shouldRouteViaIngress", () => {
	it("routes ssh project servers through a different ingress server", () => {
		expect(shouldRouteViaIngress({ id: "b", mode: "ssh" }, { id: "a" })).toBe(true);
	});

	it("does not route agent project servers", () => {
		expect(shouldRouteViaIngress({ id: "b", mode: "agent" }, { id: "a" })).toBe(false);
	});

	it("does not route when the project runs on the ingress itself", () => {
		expect(shouldRouteViaIngress({ id: "a", mode: "ssh" }, { id: "a" })).toBe(false);
	});

	it("does not route without an ingress configured", () => {
		expect(shouldRouteViaIngress({ id: "b", mode: "ssh" }, null)).toBe(false);
	});
});

describe("syncIngressRoute ssh and agent modes", () => {
	it("delegates to syncRemoteCaddyRoute for ssh ingress servers", async () => {
		const { syncIngressRoute } = await import("../ingress");
		let calledWith: any = null;
		mock.module("../ssh", () => ({
			syncRemoteCaddyRoute: mock((server: any, file: string, snippet: string) => {
				calledWith = { server, file, snippet };
				return Promise.resolve(true);
			}),
			removeRemoteCaddyRoute: mock(() => Promise.resolve(true)),
		}));
		await syncIngressRoute({ id: "server-ingress", mode: "ssh" } as any, "203.0.113.10", {
			hostname: "app.example.com",
			routeFile: "app.example.com.caddy",
			port: 3000,
			containers: ["c-1"],
		});
		expect(calledWith).not.toBeNull();
		expect(calledWith.file).toBe("app.example.com.caddy");
		expect(calledWith.snippet).toContain("reverse_proxy 203.0.113.10:80");
	});
});
