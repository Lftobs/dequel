import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateDynamicRailpackJson } from "../railpack-config-utils";

const setupWorkspace = () => {
	const dir = mkdtempSync(join(tmpdir(), "dequel-railpack-config-"));
	mkdirSync(join(dir, "client"), { recursive: true });
	return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};

describe("generateDynamicRailpackJson static subdirectory detection", () => {
	test("configures dequel-serve.js when index.html exists without package.json", async () => {
		const { dir, cleanup } = setupWorkspace();
		try {
			writeFileSync(join(dir, "client", "index.html"), "<html></html>");
			const logs: string[] = [];
			await generateDynamicRailpackJson(dir, "client", "static", null, null, async (line) => logs.push(line));
			const serveScript = join(dir, "dequel-serve.js");
			const railpackJson = join(dir, "railpack.json");
			expect(existsSync(serveScript)).toBe(true);
			expect(existsSync(railpackJson)).toBe(true);
			const parsedConfig = JSON.parse(readFileSync(railpackJson, "utf8"));
			expect(parsedConfig.deploy?.startCommand).toBe("bun dequel-serve.js");
		} finally {
			cleanup();
		}
	});

	test("does not overwrite a user-provided Staticfile", async () => {
		const { dir, cleanup } = setupWorkspace();
		try {
			writeFileSync(join(dir, "client", "index.html"), "<html></html>");
			writeFileSync(join(dir, "Staticfile"), "root: public\n");
			await generateDynamicRailpackJson(dir, "client", "railpack", null, null, async () => {});
			expect(readFileSync(join(dir, "Staticfile"), "utf8")).toBe("root: public\n");
		} finally {
			cleanup();
		}
	});

	test("does not emit Staticfile when package.json exists in source dir", async () => {
		const { dir, cleanup } = setupWorkspace();
		try {
			writeFileSync(join(dir, "client", "index.html"), "<html></html>");
			writeFileSync(
				join(dir, "client", "package.json"),
				JSON.stringify({ name: "app", scripts: { start: "node dist/index.js" } }),
			);
			const logs: string[] = [];
			await generateDynamicRailpackJson(dir, "client", "railpack", null, null, async (line) => logs.push(line));
			expect(existsSync(join(dir, "Staticfile"))).toBe(false);
			expect(logs.some((l) => l.includes("Detected static site"))).toBe(false);
		} finally {
			cleanup();
		}
	});

	describe("vite SPA without server entry", () => {
		test("serves the build output statically instead of node dist/index.js", async () => {
			const { dir, cleanup } = setupWorkspace();
			try {
				writeFileSync(
					join(dir, "client", "package.json"),
					JSON.stringify({
						name: "spa",
						scripts: { build: "vite build" },
						devDependencies: { vite: "^5.0.0", react: "^18.0.0" },
					}),
				);
				const logs: string[] = [];
				await generateDynamicRailpackJson(dir, "client", null, null, null, async (line) => logs.push(line));
				const parsedConfig = JSON.parse(readFileSync(join(dir, "railpack.json"), "utf8"));
				expect(parsedConfig.deploy?.startCommand).toBe("bun dequel-serve.js");
				expect(existsSync(join(dir, "dequel-serve.js"))).toBe(true);
				expect(parsedConfig.steps?.build?.commands?.join(" ")).toContain("run build");
			} finally {
				cleanup();
			}
		});

		test("keeps node dist/index.js fallback for vite apps with a server framework", async () => {
			const { dir, cleanup } = setupWorkspace();
			try {
				writeFileSync(
					join(dir, "client", "package.json"),
					JSON.stringify({
						name: "ssr",
						scripts: { build: "vite build" },
						dependencies: { vite: "^5.0.0", express: "^4.0.0" },
					}),
				);
				await generateDynamicRailpackJson(dir, "client", null, null, null, async () => {});
				const parsedConfig = JSON.parse(readFileSync(join(dir, "railpack.json"), "utf8"));
				expect(parsedConfig.deploy?.startCommand).toBe("cd client && node dist/index.js");
			} finally {
				cleanup();
			}
		});

		test("keeps node dist/index.js fallback for node apps that build but have no vite", async () => {
			const { dir, cleanup } = setupWorkspace();
			try {
				writeFileSync(
					join(dir, "client", "package.json"),
					JSON.stringify({ name: "plain", scripts: { build: "tsc" } }),
				);
				await generateDynamicRailpackJson(dir, "client", null, null, null, async () => {});
				const parsedConfig = JSON.parse(readFileSync(join(dir, "railpack.json"), "utf8"));
				expect(parsedConfig.deploy?.startCommand).toBe("cd client && node dist/index.js");
			} finally {
				cleanup();
			}
		});

		test("still serves statically when only client libraries like socket.io-client are present", async () => {
			const { dir, cleanup } = setupWorkspace();
			try {
				writeFileSync(
					join(dir, "client", "package.json"),
					JSON.stringify({
						name: "spa",
						scripts: { build: "vite build" },
						dependencies: { vite: "^5.0.0", "socket.io-client": "^4.0.0" },
					}),
				);
				await generateDynamicRailpackJson(dir, "client", null, null, null, async () => {});
				const parsedConfig = JSON.parse(readFileSync(join(dir, "railpack.json"), "utf8"));
				expect(parsedConfig.deploy?.startCommand).toBe("bun dequel-serve.js");
			} finally {
				cleanup();
			}
		});

		test("still serves statically when only client libraries like next-themes are present", async () => {
			const { dir, cleanup } = setupWorkspace();
			try {
				writeFileSync(
					join(dir, "client", "package.json"),
					JSON.stringify({
						name: "spa",
						scripts: { build: "vite build" },
						dependencies: { vite: "^5.0.0", "next-themes": "^0.3.0" },
					}),
				);
				await generateDynamicRailpackJson(dir, "client", null, null, null, async () => {});
				const parsedConfig = JSON.parse(readFileSync(join(dir, "railpack.json"), "utf8"));
				expect(parsedConfig.deploy?.startCommand).toBe("bun dequel-serve.js");
			} finally {
				cleanup();
			}
		});

		test("keeps node dist/index.js for vite SSR builds configured with --ssr", async () => {
			const { dir, cleanup } = setupWorkspace();
			try {
				writeFileSync(
					join(dir, "client", "package.json"),
					JSON.stringify({
						name: "ssr",
						scripts: { build: "vite build --ssr src/entry-server.ts" },
						dependencies: { vite: "^5.0.0" },
					}),
				);
				await generateDynamicRailpackJson(dir, "client", null, null, null, async () => {});
				const parsedConfig = JSON.parse(readFileSync(join(dir, "railpack.json"), "utf8"));
				expect(parsedConfig.deploy?.startCommand).toBe("cd client && node dist/index.js");
			} finally {
				cleanup();
			}
		});

		test("keeps node dist/index.js for vite SSR builds configured via config file", async () => {
			const { dir, cleanup } = setupWorkspace();
			try {
				writeFileSync(
					join(dir, "client", "package.json"),
					JSON.stringify({
						name: "ssr",
						scripts: { build: "vite build" },
						dependencies: { vite: "^5.0.0" },
					}),
				);
				writeFileSync(
					join(dir, "client", "vite.config.ts"),
					"export default { build: { ssr: 'src/entry-server.ts', outDir: 'dist/server' } };",
				);
				await generateDynamicRailpackJson(dir, "client", null, null, null, async () => {});
				const parsedConfig = JSON.parse(readFileSync(join(dir, "railpack.json"), "utf8"));
				expect(parsedConfig.deploy?.startCommand).toBe("cd client && node dist/index.js");
			} finally {
				cleanup();
			}
		});
	});
});
