import { describe, expect, test } from "bun:test";
import { buildDockerfileArgs } from "../dockerfile";

describe("buildDockerfileArgs", () => {
	test("builds a plain docker build command with a default Dockerfile", () => {
		expect(buildDockerfileArgs({ imageTag: "app:abc" })).toEqual([
			"build",
			"-t",
			"app:abc",
			"-f",
			"Dockerfile",
			"--progress",
			"plain",
			".",
		]);
	});

	test("includes custom path, target, build args, and no-cache", () => {
		const args = buildDockerfileArgs({
			imageTag: "app:abc",
			dockerfilePath: "docker/Dockerfile.prod",
			target: "runtime",
			buildArgs: [
				{ key: "NODE_ENV", value: "production" },
				{ key: "SENTRY_DSN", value: "https://example" },
			],
			clearCache: true,
			targetArgs: ["-H", "ssh://root@example"],
		});
		expect(args.slice(0, 2)).toEqual(["-H", "ssh://root@example"]);
		expect(args).toContain("docker/Dockerfile.prod");
		expect(args.join(" ")).toContain("--target runtime");
		expect(args.join(" ")).toContain("--build-arg NODE_ENV=production");
		expect(args.join(" ")).toContain("--build-arg SENTRY_DSN=https://example");
		expect(args).toContain("--no-cache");
		expect(args.at(-1)).toBe(".");
	});
});
