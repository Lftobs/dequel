import { describe, expect, test } from "bun:test";
import { normalizeTags, validateHealthCheck, validateProjectConfig } from "../project-config";

describe("normalizeTags", () => {
	test("lowercases, trims, de-duplicates, and filters invalid tags", () => {
		expect(normalizeTags(["Prod", "prod", " api ", "", "bad tag!", "-leading", "ok.tag_1"])).toEqual([
			"prod",
			"api",
			"ok.tag_1",
		]);
	});

	test("caps the number of tags and ignores non-arrays", () => {
		const many = Array.from({ length: 30 }, (_, index) => `tag-${index}`);
		expect(normalizeTags(many)).toHaveLength(20);
		expect(normalizeTags("prod")).toEqual([]);
	});
});

describe("validateHealthCheck", () => {
	test("accepts none and null", () => {
		expect(validateHealthCheck(null)).toEqual({});
		expect(validateHealthCheck({ type: "none" })).toEqual({ value: { type: "none" } });
	});

	test("normalizes http checks", () => {
		const result = validateHealthCheck({
			type: "http",
			path: "healthz",
			port: 8080,
			intervalSeconds: 15,
			timeoutSeconds: 5,
			startPeriodSeconds: 30,
			retries: 4,
		});
		expect(result.error).toBeUndefined();
		expect(result.value).toEqual({
			type: "http",
			path: "healthz",
			port: 8080,
			command: null,
			intervalSeconds: 15,
			timeoutSeconds: 5,
			startPeriodSeconds: 30,
			retries: 4,
		});
	});

	test("requires a command for command checks", () => {
		expect(validateHealthCheck({ type: "command" }).error).toContain("command is required");
	});

	test("rejects invalid ports and timings", () => {
		expect(validateHealthCheck({ type: "http", port: 70000 }).error).toContain("port");
		expect(validateHealthCheck({ type: "http", retries: 0 }).error).toContain("retries");
		expect(validateHealthCheck({ type: "http", intervalSeconds: 0 }).error).toContain("intervalSeconds");
	});
});

describe("validateProjectConfig", () => {
	test("accepts a default git project", () => {
		const result = validateProjectConfig({ name: "web" });
		expect(result.error).toBeUndefined();
		expect(result.tags).toBeUndefined();
	});

	test("requires an image for image sources", () => {
		expect(validateProjectConfig({ sourceType: "image" }).error).toContain("imageRef is required");
		expect(validateProjectConfig({ sourceType: "image", imageRef: "ghcr.io/acme/app:1" }).error).toBeUndefined();
	});

	test("rejects image sources with the dockerfile build method", () => {
		const result = validateProjectConfig({ sourceType: "image", imageRef: "nginx:1", buildType: "dockerfile" });
		expect(result.error).toContain("cannot use the dockerfile build method");
	});

	test("validates build type, provider, pull policy, restart policy, and numeric ranges", () => {
		expect(validateProjectConfig({ buildType: "nixpacks" }).error).toContain("buildType");
		expect(validateProjectConfig({ gitProvider: "sourcehut" }).error).toContain("gitProvider");
		expect(validateProjectConfig({ imagePullPolicy: "sometimes" }).error).toContain("imagePullPolicy");
		expect(validateProjectConfig({ restartPolicy: "sometimes" }).error).toContain("restartPolicy");
		expect(validateProjectConfig({ restartMaxRetries: 500 }).error).toContain("restartMaxRetries");
		expect(validateProjectConfig({ stopGracePeriodSeconds: -1 }).error).toContain("stopGracePeriodSeconds");
	});

	test("returns normalized health checks and tags", () => {
		const result = validateProjectConfig({
			healthCheck: { type: "http", path: "/ready" },
			tags: ["Prod", "prod"],
		});
		expect(result.error).toBeUndefined();
		expect(result.healthCheck?.type).toBe("http");
		expect(result.tags).toEqual(["prod"]);
	});

	test("allows partial updates without source requirements", () => {
		expect(validateProjectConfig({ tags: ["api"] }, { partial: true }).error).toBeUndefined();
	});
});
