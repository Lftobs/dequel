import { describe, expect, test } from "bun:test";
import { caddySite } from "../caddy-site";

describe("caddySite options", () => {
	test("keeps the base block unchanged without options", () => {
		const block = caddySite("app.example.com", "  reverse_proxy app:3000");
		expect(block).toContain("app.example.com {");
		expect(block).toContain("  reverse_proxy app:3000");
		expect(block).not.toContain("encode gzip");
	});

	test("adds gzip, noindex, and header overrides", () => {
		const block = caddySite("app.example.com", "  reverse_proxy app:3000", {
			gzip: true,
			noindex: true,
			httpsRedirect: false,
		});
		expect(block).toContain("auto_https disable_redirects");
		expect(block).toContain("encode gzip");
		expect(block).toContain('header X-Robots-Tag "noindex, nofollow"');
	});

	test("adds basic auth and a custom TLS block", () => {
		const block = caddySite("app.example.com", "  reverse_proxy app:3000", {
			basicAuth: { username: "admin", passwordHash: "$2a$hash" },
			tlsMode: "custom",
			certificatePath: "/etc/caddy/routes/app.example.com.crt",
			certificateKeyPath: "/etc/caddy/routes/app.example.com.key",
		});
		expect(block).toContain("basic_auth {");
		expect(block).toContain("admin $2a$hash");
		expect(block).toContain("tls /etc/caddy/routes/app.example.com.crt /etc/caddy/routes/app.example.com.key");
	});

	test("indents raw snippets inside the site block", () => {
		const block = caddySite("app.example.com", "  reverse_proxy app:3000", {
			rawSnippet: 'header X-Custom "yes"\n@blocked path /private/*\nrespond @blocked 403',
		});
		expect(block).toContain('  header X-Custom "yes"');
		expect(block).toContain("  @blocked path /private/*");
		expect(block).toContain("  respond @blocked 403");
	});
});
