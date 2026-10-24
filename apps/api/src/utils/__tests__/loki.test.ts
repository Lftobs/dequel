import { describe, expect, test } from "bun:test";
import { caddyRequestLogSelector } from "../loki";

describe("caddyRequestLogSelector", () => {
	test("extracts nested request.host and filters by host regex", () => {
		const sel = caddyRequestLogSelector("app\\.localhost");
		expect(sel.startsWith('{container="')).toBe(true);
		expect(sel).toContain("| json |");
		expect(sel.endsWith('request_host =~ "^(app\\.localhost)$"')).toBe(true);
	});
});
