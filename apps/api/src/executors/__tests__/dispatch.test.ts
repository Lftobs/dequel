import { describe, expect, it } from "bun:test";
import { executorFor } from "../dispatch";
import { buildRemoteDeployScript, parseRemoteBuildResult } from "../ssh-build-script";

const generator = "export const generateDynamicRailpackJson = async () => {};\n";

const input = {
	deploymentId: "deployment-1",
	workspaceRoot: "/var/lib/dequel/workspace",
	gitUrl: "https://github.com/example/api.git",
	branch: "main",
	commitSha: null,
	imageTag: "example-api-deploym:latest",
	clearCache: false,
	environmentVariables: [{ key: "NODE_ENV", value: "production" }],
	railpackGenerator: generator,
};

describe("remote SSH build script", () => {
	it("embeds inputs with single-quote escaping", () => {
		const script = buildRemoteDeployScript(input);
		expect(script).toContain("set -euo pipefail");
		expect(script).toContain("git clone --depth 1 'https://github.com/example/api.git' .");
		expect(script).toContain("--env 'NODE_ENV=production'");
		expect(script).toContain("--name 'example-api-deploym:latest'");
		expect(script).toContain(
			'echo "RESULT:{\\"imageTag\\":\\"example-api-deploym:latest\\",\\"commitSha\\":\\"$SHA\\"}"',
		);
	});

	it("escapes single quotes in values", () => {
		const script = buildRemoteDeployScript({
			...input,
			environmentVariables: [{ key: "GREETING", value: "it's fine" }],
		});
		expect(script).toContain("--env 'GREETING=it'\\''s fine'");
	});

	it("checks out a specific commit when provided", () => {
		const script = buildRemoteDeployScript({ ...input, commitSha: "abc1234", branch: null });
		expect(script).toContain("git fetch --depth 1 origin 'abc1234' && git checkout 'abc1234'");
	});

	it("uses a fresh cache key for clear builds", () => {
		const script = buildRemoteDeployScript({ ...input, clearCache: true });
		expect(script).toContain("--cache-key 'example-api-deploym-clear-");
	});

	it("installs railpack when missing", () => {
		const script = buildRemoteDeployScript(input);
		expect(script).toContain("curl -fsSL https://railpack.com/install.sh");
	});

	it("ships the railpack generator into the workspace after the clone", () => {
		const script = buildRemoteDeployScript(input);
		expect(script).toContain("cat > \"$PROJECT_DIR/.dequel-railpack-gen.ts\" <<'DEQUEL_RAILPACK_GEN_EOF'");
		expect(script).toContain(generator);
		expect(script).toContain("await generateDynamicRailpackJson(");
		expect(script.indexOf("git clone")).toBeLessThan(script.indexOf("DEQUEL_RAILPACK_GEN_EOF"));
		expect(script).toContain('bun "$PROJECT_DIR/.dequel-railpack-gen.ts" "$PROJECT_DIR"');
		expect(script).toContain("DEQUEL_RAILPACK_GEN_EOF\nbun ");
	});

	it("installs bun before generating the config", () => {
		const script = buildRemoteDeployScript(input);
		expect(script).toContain("bun-linux-${BUN_ARCH}.zip");
		expect(script).toContain("python3 -m zipfile -e");
		expect(script).toContain("bun.sh/install");
		expect(script).toContain('export PATH="$HOME/.bun/bin:$PATH"');
		expect(script.indexOf("bun-linux-${BUN_ARCH}.zip")).toBeLessThan(script.indexOf(".dequel-railpack-gen.ts"));
	});

	it("passes source dir and project type to the generator", () => {
		const script = buildRemoteDeployScript({
			...input,
			sourceDir: "client",
			projectType: "static",
			buildCommand: "npm run build",
			startCommand: "npm start",
			installCommand: null,
			outputDir: null,
		});
		expect(script).toContain(
			`bun "$PROJECT_DIR/.dequel-railpack-gen.ts" "$PROJECT_DIR" 'client' 'static' 'npm run build' 'npm start' '' ''`,
		);
	});

	it("escapes single quotes in the source dir", () => {
		const script = buildRemoteDeployScript({ ...input, sourceDir: "it's" });
		expect(script).toContain(`"$PROJECT_DIR" 'it'\\''s'`);
	});
});

describe("remote build result parsing", () => {
	it("parses the RESULT marker", () => {
		expect(parseRemoteBuildResult('line1\nRESULT:{"imageTag":"x:latest","commitSha":"deadbeef"}')).toEqual({
			imageTag: "x:latest",
			commitSha: "deadbeef",
		});
	});

	it("returns null when the marker is missing", () => {
		expect(parseRemoteBuildResult("no marker here")).toBeNull();
		expect(parseRemoteBuildResult("RESULT:not-json")).toBeNull();
	});
});

describe("executor dispatch", () => {
	it("maps each mode to its executor", () => {
		expect(executorFor("ssh").mode).toBe("ssh");
		expect(executorFor("agent").mode).toBe("agent");
	});

	it("throws for unknown modes", () => {
		expect(() => executorFor("bogus")).toThrow("Unsupported server mode");
	});
});
