import { describe, expect, test } from "bun:test";
import {
	buildAuthenticatedGitUrl,
	buildGitAuthEnv,
	detectGitProvider,
	gitAuthScriptLines,
	isGithubHttpsUrl,
	isHttpsGitUrl,
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

	test("builds authenticated https urls for known and generic providers", () => {
		expect(buildAuthenticatedGitUrl("https://github.com/owner/repo", "tok")).toBe(
			"https://x-access-token:tok@github.com/owner/repo",
		);
		expect(buildAuthenticatedGitUrl("https://github.com/owner/repo", null)).toBe("https://github.com/owner/repo");
		expect(buildAuthenticatedGitUrl("https://gitlab.com/owner/repo", "tok")).toBe(
			"https://oauth2:tok@gitlab.com/owner/repo",
		);
		expect(buildAuthenticatedGitUrl("https://bitbucket.org/owner/repo", "tok")).toBe(
			"https://x-token-auth:tok@bitbucket.org/owner/repo",
		);
		expect(buildAuthenticatedGitUrl("https://git.example.com/owner/repo", "tok")).toBe(
			"https://oauth2:tok@git.example.com/owner/repo",
		);
		expect(buildAuthenticatedGitUrl("https://user@github.com/owner/repo", "tok")).toBe(
			"https://user@github.com/owner/repo",
		);
		expect(buildAuthenticatedGitUrl("git@github.com:owner/repo.git", "tok")).toBe("git@github.com:owner/repo.git");
	});

	test("prefers the configured provider over host detection", () => {
		expect(buildAuthenticatedGitUrl("https://git.example.com/owner/repo", "tok", "github")).toBe(
			"https://x-access-token:tok@git.example.com/owner/repo",
		);
		expect(buildAuthenticatedGitUrl("https://github.com/owner/repo", "tok", "gitlab")).toBe(
			"https://oauth2:tok@github.com/owner/repo",
		);
	});

	test("detects providers from repository hosts", () => {
		expect(detectGitProvider("https://github.com/owner/repo")).toBe("github");
		expect(detectGitProvider("https://gitlab.com/owner/repo")).toBe("gitlab");
		expect(detectGitProvider("https://bitbucket.org/owner/repo")).toBe("bitbucket");
		expect(detectGitProvider("https://codeberg.org/owner/repo")).toBe("gitea");
		expect(detectGitProvider("https://git.example.com/owner/repo")).toBe("generic");
	});

	test("identifies https git urls", () => {
		expect(isHttpsGitUrl("https://gitlab.com/owner/repo")).toBe(true);
		expect(isHttpsGitUrl("http://gitlab.com/owner/repo")).toBe(false);
		expect(isHttpsGitUrl("git@gitlab.com:owner/repo.git")).toBe(false);
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
