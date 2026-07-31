import { describe, it, expect } from "bun:test";
import { validateComposeServices, validateComposeServiceMapping } from "../validate";

describe("validateComposeServiceMapping", () => {
	it("accepts a valid mapping", () => {
		expect(validateComposeServiceMapping({ serviceName: "web", subdomain: "app", port: 3000 })).toBeNull();
	});

	it("rejects serviceName with spaces or braces", () => {
		expect(validateComposeServiceMapping({ serviceName: "x} { respond" })).not.toBeNull();
		expect(validateComposeServiceMapping({ serviceName: "a b" })).not.toBeNull();
		expect(validateComposeServiceMapping({ serviceName: "" })).not.toBeNull();
	});

	it("rejects subdomain injection attempts", () => {
		expect(validateComposeServiceMapping({ serviceName: "web", subdomain: "x} { respond \"owned\" } {.x" })).not.toBeNull();
		expect(validateComposeServiceMapping({ serviceName: "web", subdomain: "UPPER" })).not.toBeNull();
		expect(validateComposeServiceMapping({ serviceName: "web", subdomain: "-bad" })).not.toBeNull();
		expect(validateComposeServiceMapping({ serviceName: "web", subdomain: "ok-label" })).toBeNull();
	});

	it("rejects invalid ports", () => {
		expect(validateComposeServiceMapping({ serviceName: "web", port: 0 })).not.toBeNull();
		expect(validateComposeServiceMapping({ serviceName: "web", port: 65536 })).not.toBeNull();
		expect(validateComposeServiceMapping({ serviceName: "web", port: "80} {" })).not.toBeNull();
		expect(validateComposeServiceMapping({ serviceName: "web", port: "8080" })).toBeNull();
	});

	it("rejects non-object mappings", () => {
		expect(validateComposeServiceMapping("web")).not.toBeNull();
		expect(validateComposeServiceMapping(null)).not.toBeNull();
	});
});

describe("validateComposeServices", () => {
	it("accepts a valid array", () => {
		const result = validateComposeServices([{ serviceName: "web", subdomain: "app", port: 3000 }]);
		expect(result.ok).toBe(true);
	});

	it("accepts a valid JSON string", () => {
		const result = validateComposeServices('[{"serviceName":"web","subdomain":"app"}]');
		expect(result.ok).toBe(true);
	});

	it("rejects invalid JSON", () => {
		const result = validateComposeServices('{not json');
		expect(result.ok).toBe(false);
	});

	it("rejects non-array values", () => {
		expect(validateComposeServices({}).ok).toBe(false);
		expect(validateComposeServices("web").ok).toBe(false);
	});

	it("rejects an array with an injection payload", () => {
		const result = validateComposeServices([{ serviceName: "web", subdomain: "x} { respond \"owned\" } {.x" }]);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("subdomain");
		}
	});
});
