import { describe, expect, mock, test, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseAllComposeServices, parseComposeTarget, parseContainerTargetPort } from "../compose";

describe("parseContainerTargetPort", () => {
	test("parses number ports", () => {
		expect(parseContainerTargetPort(8080)).toBe(8080);
	});

	test("parses host-bound IP mapping 127.0.0.1:8080:80", () => {
		expect(parseContainerTargetPort("127.0.0.1:8080:80")).toBe(80);
	});

	test("parses mapping 8080:80", () => {
		expect(parseContainerTargetPort("8080:80")).toBe(80);
	});

	test("parses string with protocol suffix 0.0.0.0:9000:9000/tcp", () => {
		expect(parseContainerTargetPort("0.0.0.0:9000:9000/tcp")).toBe(9000);
	});

	test("parses long-form port object", () => {
		expect(parseContainerTargetPort({ target: 8080, published: 80 })).toBe(8080);
	});
});

describe("parseComposeTarget", () => {
	test("parses single service with ports correctly", () => {
		const dir = mkdtempSync(join(tmpdir(), "dequel-compose-test-"));
		try {
			const yaml = `
version: '3.8'
services:
  server:
    build: .
    ports:
      - "3001"
`;
			writeFileSync(join(dir, "docker-compose.yml"), yaml);
			const target = parseComposeTarget(dir);
			expect(target.serviceName).toBe("server");
			expect(target.port).toBe(3001);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("parses mapping with host:container ports", () => {
		const dir = mkdtempSync(join(tmpdir(), "dequel-compose-test-"));
		try {
			const yaml = `
version: '3.8'
services:
  web:
    image: nginx
    ports:
      - "127.0.0.1:8080:80"
  db:
    image: postgres
`;
			writeFileSync(join(dir, "docker-compose.yml"), yaml);
			const target = parseComposeTarget(dir);
			expect(target.serviceName).toBe("web");
			expect(target.port).toBe(80);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("respects preferred service and port overrides", () => {
		const dir = mkdtempSync(join(tmpdir(), "dequel-compose-test-"));
		try {
			const yaml = `
version: '3.8'
services:
  api:
    build: ./api
  web:
    build: ./web
`;
			writeFileSync(join(dir, "docker-compose.yml"), yaml);
			const target = parseComposeTarget(dir, null, "api", 4000);
			expect(target.serviceName).toBe("api");
			expect(target.port).toBe(4000);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("parseAllComposeServices", () => {
	test("extracts all services with target ports and long-form syntax", () => {
		const dir = mkdtempSync(join(tmpdir(), "dequel-compose-test-"));
		try {
			const yaml = `
version: '3.8'
services:
  web:
    build: ./web
    ports:
      - "127.0.0.1:8080:80"
  api:
    build: ./api
    ports:
      - target: 5000
        published: 8080
`;
			writeFileSync(join(dir, "docker-compose.yml"), yaml);
			const services = parseAllComposeServices(dir);
			expect(services.length).toBe(2);
			const web = services.find((s) => s.serviceName === "web");
			const api = services.find((s) => s.serviceName === "api");
			expect(web?.port).toBe(80);
			expect(web?.isPrimary).toBe(true);
			expect(api?.port).toBe(5000);
			expect(api?.isPrimary).toBe(false);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("spawnComposeCommand env isolation", () => {
	afterEach(() => {
		mock.restore();
	});

	test("does not pass process.env to docker compose subprocess", async () => {
		process.env.DATABASE_URL = "postgresql://dequel:secret@localhost:5432/dequel";
		process.env.PORT = "3001";
		process.env.WORKSPACE_ROOT = "./workspace";

		let capturedEnv: Record<string, string> | undefined;
		const originalSpawn = (await import("node:child_process")).spawn;
		mock.module("node:child_process", () => ({
			spawn: (...args: any[]) => {
				capturedEnv = args[2]?.env;
				const child = originalSpawn(...args);
				setTimeout(() => child.kill("SIGTERM"), 10);
				return child;
			},
		}));

		const dir = mkdtempSync(join(tmpdir(), "dequel-compose-env-test-"));
		try {
			writeFileSync(
				join(dir, "docker-compose.yml"),
				`version: '3.8'\nservices:\n  app:\n    image: alpine\n    command: echo "hello"`,
			);

			const { buildWithCompose } = await import("../compose");
			const projectEnv = { MY_APP_VAR: "hello", ANOTHER_VAR: "world" };

			try {
				await buildWithCompose(dir, "test-project", async () => {}, null, projectEnv);
			} catch {
				// Expected to fail since we're killing the process
			}

			expect(capturedEnv).toBeDefined();
			expect(capturedEnv).not.toHaveProperty("DATABASE_URL");
			expect(capturedEnv).not.toHaveProperty("PORT");
			expect(capturedEnv).not.toHaveProperty("WORKSPACE_ROOT");
			expect(capturedEnv).toHaveProperty("MY_APP_VAR", "hello");
			expect(capturedEnv).toHaveProperty("ANOTHER_VAR", "world");
		} finally {
			rmSync(dir, { recursive: true, force: true });
			delete process.env.DATABASE_URL;
			delete process.env.PORT;
			delete process.env.WORKSPACE_ROOT;
		}
	});

	test("passes empty env when no project env vars provided", async () => {
		process.env.DATABASE_URL = "postgresql://dequel:secret@localhost:5432/dequel";

		let capturedEnv: Record<string, string> | undefined;
		const originalSpawn = (await import("node:child_process")).spawn;
		mock.module("node:child_process", () => ({
			spawn: (...args: any[]) => {
				capturedEnv = args[2]?.env;
				const child = originalSpawn(...args);
				setTimeout(() => child.kill("SIGTERM"), 10);
				return child;
			},
		}));

		const dir = mkdtempSync(join(tmpdir(), "dequel-compose-env-test-"));
		try {
			writeFileSync(
				join(dir, "docker-compose.yml"),
				`version: '3.8'\nservices:\n  app:\n    image: alpine\n    command: echo "hello"`,
			);

			const { buildWithCompose } = await import("../compose");

			try {
				await buildWithCompose(dir, "test-project", async () => {}, null, undefined);
			} catch {
				// Expected to fail since we're killing the process
			}

			expect(capturedEnv).toBeDefined();
			expect(capturedEnv).toEqual({});
		} finally {
			rmSync(dir, { recursive: true, force: true });
			delete process.env.DATABASE_URL;
		}
	});
});
