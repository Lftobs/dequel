import { describe, test, expect } from "bun:test";
import { generateDynamicRailpackJson } from "../railpack-config-utils";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const setupWorkspace = () => {
	const dir = mkdtempSync(join(tmpdir(), "dequel-railpack-config-"));
	mkdirSync(join(dir, "client"), { recursive: true });
	return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};

describe("generateDynamicRailpackJson static subdirectory detection", () => {
	test("writes Staticfile pointing at source dir when index.html exists without package.json", async () => {
		const { dir, cleanup } = setupWorkspace();
		try {
			writeFileSync(join(dir, "client", "index.html"), "<html></html>");
			const logs: string[] = [];
			await generateDynamicRailpackJson(
				dir,
				"client",
				"railpack",
				null,
				null,
				async (line) => logs.push(line),
			);
			const staticfile = join(dir, "Staticfile");
			expect(existsSync(staticfile)).toBe(true);
			expect(readFileSync(staticfile, "utf8")).toBe("root: client\n");
			expect(existsSync(join(dir, "railpack.json"))).toBe(true);
			expect(logs.some((l) => l.includes("Detected static site in client"))).toBe(true);
		} finally {
			cleanup();
		}
	});

	test("does not overwrite a user-provided Staticfile", async () => {
		const { dir, cleanup } = setupWorkspace();
		try {
			writeFileSync(join(dir, "client", "index.html"), "<html></html>");
			writeFileSync(join(dir, "Staticfile"), "root: public\n");
			await generateDynamicRailpackJson(
				dir,
				"client",
				"railpack",
				null,
				null,
				async () => {},
			);
			expect(readFileSync(join(dir, "Staticfile"), "utf8")).toBe("root: public\n");
		} finally {
			cleanup();
		}
	});

	test("does not emit Staticfile when package.json exists in source dir", async () => {
		const { dir, cleanup } = setupWorkspace();
		try {
			writeFileSync(join(dir, "client", "index.html"), "<html></html>");
			writeFileSync(join(dir, "client", "package.json"), JSON.stringify({ name: "app", scripts: { start: "node dist/index.js" } }));
			const logs: string[] = [];
			await generateDynamicRailpackJson(
				dir,
				"client",
				"railpack",
				null,
				null,
				async (line) => logs.push(line),
			);
			expect(existsSync(join(dir, "Staticfile"))).toBe(false);
			expect(logs.some((l) => l.includes("Detected static site"))).toBe(false);
		} finally {
			cleanup();
		}
	});
});
