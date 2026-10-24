import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	evaluateComposeContainerState,
	parseAllComposeServices,
	parseComposeTarget,
	parseContainerTargetPort,
} from "../compose";

describe("evaluateComposeContainerState", () => {
	test("running after stability window is ok", () => {
		const v = evaluateComposeContainerState("c", "running", { primary: true, everSawRunning: true });
		expect(v.kind).toBe("ok");
	});

	test("first running observation still requires a stability re-check", () => {
		const v = evaluateComposeContainerState("c", "running", { primary: true, everSawRunning: false });
		expect(v.kind).toBe("retry");
	});

	test("created containers retry", () => {
		const v = evaluateComposeContainerState("c", "created", { primary: true });
		expect(v.kind).toBe("retry");
	});

	test("missing containers retry", () => {
		const v = evaluateComposeContainerState("c", null, { primary: true });
		expect(v.kind).toBe("retry");
	});

	test("primary crash loops are fatal", () => {
		const v = evaluateComposeContainerState("c", "restarting", { primary: true });
		expect(v.kind).toBe("fatal");
	});

	test("primary exits are fatal", () => {
		const v = evaluateComposeContainerState("c", "exited", { primary: true });
		expect(v.kind).toBe("fatal");
	});

	test("secondary exits retry instead of failing the deployment", () => {
		const v = evaluateComposeContainerState("c", "exited", { primary: false });
		expect(v.kind).toBe("retry");
	});

	test("unknown states retry with the state surfaced", () => {
		const v = evaluateComposeContainerState("c", "paused", { primary: false });
		expect(v.kind).toBe("retry");
		expect(v.reason).toContain("paused");
	});
});

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

describe("spawnComposeCommand env merge with project env vars", () => {
	let originalSpawn: any;

	afterEach(() => {
		mock.restore();
		if (originalSpawn) {
			mock.module("node:child_process", () => ({ spawn: originalSpawn }));
		}
	});

	test("passes project env vars alongside process.env to docker compose subprocess", async () => {
		process.env.IDEK_DATABASE_URL = "postgresql://dequel:secret@localhost:5432/dequel";
		process.env.IDEK_PORT = "3001";

		let capturedEnv: Record<string, string> | undefined;
		originalSpawn = (await import("node:child_process")).spawn;
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
			const projectEnv = { MY_APP_VAR: "hello", ANOTHER_VAR: "world", IDEK_PORT: "4000" };

			try {
				await buildWithCompose(dir, "test-project", async () => {}, null, projectEnv);
			} catch {
				// Expected to fail since we're killing the process
			}

			expect(capturedEnv).toBeDefined();
			expect(capturedEnv).toHaveProperty("MY_APP_VAR", "hello");
			expect(capturedEnv).toHaveProperty("ANOTHER_VAR", "world");
			expect(capturedEnv).toHaveProperty("IDEK_DATABASE_URL", "postgresql://dequel:secret@localhost:5432/dequel");
			expect(capturedEnv).toHaveProperty("PATH");
			expect(capturedEnv).toHaveProperty("IDEK_PORT", "4000");
		} finally {
			rmSync(dir, { recursive: true, force: true });
			delete process.env.IDEK_DATABASE_URL;
			delete process.env.IDEK_PORT;
		}
	});
	test("passes process.env through when no project env vars provided", async () => {
		process.env.IDEK_DATABASE_URL = "postgresql://dequel:secret@localhost:5432/dequel";

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
			expect(capturedEnv).toHaveProperty("IDEK_DATABASE_URL", "postgresql://dequel:secret@localhost:5432/dequel");
			expect(capturedEnv).toHaveProperty("PATH");
		} finally {
			rmSync(dir, { recursive: true, force: true });
			delete process.env.IDEK_DATABASE_URL;
		}
	});
});

describe("writeComposeEnvFile", () => {
	const runFailingBuild = async (dir: string, envVars: Record<string, string>) => {
		const { buildWithCompose } = await import("../compose");
		try {
			await buildWithCompose(dir, "envfile-proj", async () => {}, null, envVars);
		} catch {
			// compose build fails fast on the bad build context; the .env write happens before spawn
		}
	};

	const withComposeDir = async (fn: (dir: string) => Promise<void>) => {
		const dir = mkdtempSync(join(tmpdir(), "dequel-compose-envfile-"));
		writeFileSync(join(dir, "docker-compose.yml"), `services:\n  app:\n    build: {NEVER_EXISTS}\n`);
		try {
			await fn(dir);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	};

	test("writes project env vars as an escaped .env beside the compose file", async () => {
		await withComposeDir(async (dir) => {
			await runFailingBuild(dir, { SECRET_ONE: "pa55$$word", MULTI: 'a\nb"c', "1BAD-KEY": "skip" });
			const content = readFileSync(join(dir, ".env"), "utf8");
			expect(content).toContain('SECRET_ONE="pa55$$$$word"');
			expect(content).toContain('MULTI="a\\nb\\"c"');
			expect(content).not.toContain("1BAD-KEY");
		});
	});

	test("does not overwrite an existing .env from the archive", async () => {
		await withComposeDir(async (dir) => {
			writeFileSync(join(dir, ".env"), "FROM_ARCHIVE=1\n");
			await runFailingBuild(dir, { SECRET_ONE: "fresh" });
			expect(readFileSync(join(dir, ".env"), "utf8")).toBe("FROM_ARCHIVE=1\n");
		});
	});
});
