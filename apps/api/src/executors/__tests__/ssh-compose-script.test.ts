import { describe, expect, test } from "bun:test";
import { buildRemoteComposeScript } from "../ssh-compose-script";

const input = {
	deploymentId: "abc123",
	workspaceRoot: "/home/admin/.dequl/workspace",
	gitUrl: "https://github.com/owner/repo",
	commitSha: null,
	projectName: "test",
	dockerNetwork: "dequl_net",
	environmentVariables: [{ key: "PASS", value: "pa$w0rd" }],
};

describe("buildRemoteComposeScript", () => {
	test("escapes dollar signs before writing the env override so compose interpolation cannot eat them", () => {
		const script = buildRemoteComposeScript(input);
		expect(script).toContain('json.dumps(v.replace("$", "$$"))');
	});

	test("emits a shell-parseable script", () => {
		expect(() => buildRemoteComposeScript(input)).not.toThrow();
		expect(buildRemoteComposeScript(input)).toContain("git clone --depth 1");
	});
});
