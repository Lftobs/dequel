import { describe, expect, test } from "bun:test";
import {
	buildAuthenticatedGitUrl,
	buildGitAuthEnv,
	gitAuthScriptLines,
	isGithubHttpsUrl,
	redactGitUrl,
} from "../source";

describe("git URL helpers", () => {
	test("identifies github https urls", () => {
		expect(isGithubHttpsUrl("https://github.com/owner/repo")).toBe(true);
		expect(isGithubHttpsUrl("HTTPS://GITHUB.COM/owner/repo")).toBe(true);
		expect(isGithubHttpsUrl("https://gitlab.com/owner/repo")).toBe(false);
		expect(isGithubHttpsUrl("git@github.com:owner/repo.git")).toBe(false);
	});

	test("redacts credential-bearing urls", () => {
		expect(redactGitUrl("https://x-access-token:abc123@github.com/owner/repo")).toBe("https://github.com/owner/repo");
		expect(redactGitUrl("https://github.com/owner/repo")).toBe("https://github.com/owner/repo");
	});

	test("builds authenticated github urls only for https github repos", () => {
		expect(buildAuthenticatedGitUrl("https://github.com/owner/repo", "tok")).toBe(
			"https://x-access-token:tok@github.com/owner/repo",
		);
		expect(buildAuthenticatedGitUrl("https://github.com/owner/repo", null)).toBe("https://github.com/owner/repo");
		expect(buildAuthenticatedGitUrl("https://gitlab.com/owner/repo", "tok")).toBe("https://gitlab.com/owner/repo");
		expect(buildAuthenticatedGitUrl("https://user@github.com/owner/repo", "tok")).toBe(
			"https://user@github.com/owner/repo",
		);
	});
});

describe("buildGitAuthEnv", () => {
	test("rewrites clean urls over the tokenized one via env instead of repo config", () => {
		const auth = buildGitAuthEnv("https://x-access-token:tok@github.com/owner/repo");
		expect(auth?.cleanUrl).toBe("https://github.com/owner/repo");
		expect(auth?.env.GIT_CONFIG_COUNT).toBe("1");
		expect(auth?.env.GIT_CONFIG_KEY_0).toBe("url.https://x-access-token:tok@github.com/owner/repo.insteadOf");
		expect(auth?.env.GIT_CONFIG_VALUE_0).toBe("https://github.com/owner/repo");
	});

	test("returns null when the url carries no credentials", () => {
		expect(buildGitAuthEnv("https://github.com/owner/repo")).toBeNull();
		expect(buildGitAuthEnv("https://gitlab.com/owner/repo")).toBeNull();
	});
});

describe("gitAuthScriptLines", () => {
	test("emits quoted env exports for authenticated urls", () => {
		const lines = gitAuthScriptLines("https://x-access-token:to'k@github.com/owner/repo");
		expect(lines).toHaveLength(3);
		expect(lines[0]).toBe('export GIT_CONFIG_COUNT="1"');
		expect(lines[1]).toContain("url.https://x-access-token:to");
		expect(lines[1]).toContain(".insteadOf");
		expect(lines[2]).toContain("https://github.com/owner/repo");
	});

	test("emits nothing for credential-free urls", () => {
		expect(gitAuthScriptLines("https://github.com/owner/repo")).toEqual([]);
	});
});
