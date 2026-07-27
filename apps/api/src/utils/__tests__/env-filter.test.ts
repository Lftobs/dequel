import { describe, test, expect } from "bun:test";
import { isBuildSafeEnv, filterBuildEnvVars } from "../env-filter";

describe("isBuildSafeEnv", () => {
	test("allows NEXT_PUBLIC_ prefix", () => {
		expect(isBuildSafeEnv("NEXT_PUBLIC_API_URL")).toBe(true);
		expect(isBuildSafeEnv("NEXT_PUBLIC_STRIPE_KEY")).toBe(true);
	});

	test("allows VITE_ prefix", () => {
		expect(isBuildSafeEnv("VITE_API_URL")).toBe(true);
		expect(isBuildSafeEnv("VITE_APP_TITLE")).toBe(true);
	});

	test("allows REACT_APP_ prefix", () => {
		expect(isBuildSafeEnv("REACT_APP_API_URL")).toBe(true);
	});

	test("allows NUXT_PUBLIC_ prefix", () => {
		expect(isBuildSafeEnv("NUXT_PUBLIC_API_BASE")).toBe(true);
	});

	test("allows NUXT_ENV_ prefix", () => {
		expect(isBuildSafeEnv("NUXT_ENV_COOL_WORD")).toBe(true);
	});

	test("allows GATSBY_ prefix", () => {
		expect(isBuildSafeEnv("GATSBY_API_URL")).toBe(true);
	});

	test("allows PUBLIC_ prefix (Astro/SvelteKit)", () => {
		expect(isBuildSafeEnv("PUBLIC_SUPABASE_URL")).toBe(true);
		expect(isBuildSafeEnv("PUBLIC_ANALYTICS_ID")).toBe(true);
	});


	test("allows STORYBOOK_ prefix", () => {
		expect(isBuildSafeEnv("STORYBOOK_API_URL")).toBe(true);
	});

	test("allows safe exact matches", () => {
		expect(isBuildSafeEnv("NODE_ENV")).toBe(true);
		expect(isBuildSafeEnv("CI")).toBe(true);
		expect(isBuildSafeEnv("GENERATE_SOURCEMAP")).toBe(true);
		expect(isBuildSafeEnv("SENTRY_DSN")).toBe(true);
	});

	test("rejects secrets and runtime vars", () => {
		expect(isBuildSafeEnv("DATABASE_URL")).toBe(false);
		expect(isBuildSafeEnv("API_SECRET_KEY")).toBe(false);
		expect(isBuildSafeEnv("JWT_SECRET")).toBe(false);
		expect(isBuildSafeEnv("SMTP_PASSWORD")).toBe(false);
		expect(isBuildSafeEnv("REDIS_URL")).toBe(false);
		expect(isBuildSafeEnv("AWS_SECRET_ACCESS_KEY")).toBe(false);
		expect(isBuildSafeEnv("STRIPE_SECRET_KEY")).toBe(false);
	});

	test("rejects partial prefix matches", () => {
		expect(isBuildSafeEnv("NEXT_PRIVATE_KEY")).toBe(false);
		expect(isBuildSafeEnv("VITEPRESS_KEY")).toBe(false);
	});
});

describe("filterBuildEnvVars", () => {
	test("filters mixed env vars correctly", () => {
		const input = [
			{ key: "NEXT_PUBLIC_API_URL", value: "https://api.example.com" },
			{ key: "DATABASE_URL", value: "postgres://user:pass@host/db" },
			{ key: "VITE_APP_TITLE", value: "My App" },
			{ key: "JWT_SECRET", value: "supersecret" },
			{ key: "NODE_ENV", value: "production" },
			{ key: "STRIPE_SECRET_KEY", value: "sk_live_xxx" },
			{ key: "PUBLIC_SUPABASE_URL", value: "https://xxx.supabase.co" },
		];

		const result = filterBuildEnvVars(input);
		expect(result).toEqual([
			{ key: "NEXT_PUBLIC_API_URL", value: "https://api.example.com" },
			{ key: "VITE_APP_TITLE", value: "My App" },
			{ key: "NODE_ENV", value: "production" },
			{ key: "PUBLIC_SUPABASE_URL", value: "https://xxx.supabase.co" },
		]);
	});

	test("returns empty array when no build-safe vars", () => {
		const input = [
			{ key: "DATABASE_URL", value: "postgres://..." },
			{ key: "API_KEY", value: "secret" },
		];
		expect(filterBuildEnvVars(input)).toEqual([]);
	});

	test("returns all vars when all are build-safe", () => {
		const input = [
			{ key: "NEXT_PUBLIC_URL", value: "https://..." },
			{ key: "NODE_ENV", value: "production" },
		];
		expect(filterBuildEnvVars(input)).toEqual(input);
	});
});
