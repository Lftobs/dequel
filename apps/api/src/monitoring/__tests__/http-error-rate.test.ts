import { describe, expect, it } from "bun:test";
import { parseHttpErrorRate } from "../http-error-rate";

const sample = [
	{ metric: { status: "200" }, value: ["1758000000", "480"] },
	{ metric: { status: "204" }, value: ["1758000000", "20"] },
	{ metric: { status: "404" }, value: ["1758000000", "12"] },
	{ metric: { status: "500" }, value: ["1758000000", "8"] },
];

describe("parseHttpErrorRate", () => {
	it("derives totals and rate from status buckets", () => {
		const result = parseHttpErrorRate(sample, 3600);
		expect(result.available).toBe(true);
		expect(result.windowSeconds).toBe(3600);
		expect(result.totalRequests).toBe(520);
		expect(result.errorRequests).toBe(20);
		expect(result.errorRate).toBeCloseTo(20 / 520, 10);
		expect(result.byStatus).toHaveLength(4);
	});

	it("returns errorRate null on no traffic", () => {
		const result = parseHttpErrorRate([], 300);
		expect(result.available).toBe(true);
		expect(result.totalRequests).toBe(0);
		expect(result.errorRate).toBeNull();
	});

	it("marks unavailable payloads instead of reporting 0", () => {
		for (const payload of [null, undefined, "nope", { not: "an array" }]) {
			const result = parseHttpErrorRate(payload, 300);
			expect(result.available).toBe(false);
			expect(result.errorRate).toBeNull();
			expect(result.totalRequests).toBe(0);
			expect(result.byStatus).toHaveLength(0);
		}
	});

	it("filters malformed bucket entries", () => {
		const result = parseHttpErrorRate(
			[
				{ metric: { status: "200" }, value: ["1", "10"] },
				{ metric: {}, value: ["1", "5"] },
				{ metric: { status: "201" }, value: ["1", "not-a-number"] },
				null,
			],
			60,
		);
		expect(result.available).toBe(true);
		expect(result.totalRequests).toBe(10);
		expect(result.byStatus).toHaveLength(1);
	});

	it("counts 4xx and 5xx as errors but not 3xx", () => {
		const result = parseHttpErrorRate(
			[
				{ metric: { status: "301" }, value: ["1", "100"] },
				{ metric: { status: "404" }, value: ["1", "1"] },
			],
			60,
		);
		expect(result.errorRequests).toBe(1);
		expect(result.errorRate).toBeCloseTo(1 / 101, 10);
	});
});
