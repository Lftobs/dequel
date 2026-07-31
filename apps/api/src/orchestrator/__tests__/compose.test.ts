import { describe, test, expect } from "bun:test";
import { parseComposeTarget } from "../compose";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
      - "8080:80"
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
