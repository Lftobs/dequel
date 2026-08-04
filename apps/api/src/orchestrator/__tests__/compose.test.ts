import { describe, test, expect } from "bun:test";
import { parseComposeTarget, parseContainerTargetPort, extractComposeServices, parseAllComposeServices } from "../compose";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
