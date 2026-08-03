import { describe, expect, it } from "bun:test";
import { isValidCidr, validateDatabaseCreate } from "../validation";
describe("database input validation", () => {
	it("accepts public access with an IPv4 allowlist", () => {
		const result = validateDatabaseCreate({
			name: "orders",
			type: "postgresql",
			allowedCidrs: ["203.0.113.4/32"],
		});
		expect(result.ok).toBe(true);
	});

	it("rejects public access without an allowlist or explicit allow-anywhere", () => {
		const result = validateDatabaseCreate({ name: "orders", type: "postgresql" });
		expect(result.ok).toBe(false);
	});

	it("allows private-only databases without an allowlist", () => {
		const result = validateDatabaseCreate({
			name: "orders",
			type: "postgresql",
			publicAccess: false,
		});
		expect(result.ok).toBe(true);
	});

	it("validates IPv4 CIDRs and rejects IPv6 ranges", () => {
		expect(isValidCidr("10.0.0.0/8")).toBe(true);
		expect(isValidCidr("203.0.113.4")).toBe(true);
		expect(isValidCidr("2001:db8::/32")).toBe(false);
		expect(isValidCidr("10.0.0.1/33")).toBe(false);
		expect(isValidCidr("not-an-ip/24")).toBe(false);
	});

	it("rejects more than 20 allowed CIDRs", () => {
		const result = validateDatabaseCreate({
			name: "orders",
			type: "postgresql",
			allowedCidrs: Array.from({ length: 21 }, (_, index) => `10.0.${index}.0/24`),
		});
		expect(result.ok).toBe(false);
	});

	it("rejects unsafe image versions", () => {
		const result = validateDatabaseCreate({
			name: "orders",
			type: "postgresql",
			version: "latest;evil",
			allowPublicAccessFromAnywhere: true,
		});
		expect(result.ok).toBe(false);
	});
});
