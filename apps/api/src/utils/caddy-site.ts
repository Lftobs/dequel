import { CADDY_CLOUDFLARE_TRUSTED_PROXIES } from "./cloudflare";

export const CADDY_ACCESS_LOG_BLOCK = `  log {
    output stdout
    format json
  }`;

export const CADDY_SECURITY_HEADERS_BLOCK = `  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
    Permissions-Policy "camera=(), microphone=(), geolocation=()"
    -Server
  }`;

export const CADDY_REQUEST_LIMITS_BLOCK = `  request_body {
    max_size 100MB
  }`;

export interface CaddySiteOptions {
	includeSecurityHeaders?: boolean;
	includeRequestLimits?: boolean;
	tlsMode?: "auto" | "custom" | "dns";
	certificatePath?: string | null;
	certificateKeyPath?: string | null;
	basicAuth?: { username: string; passwordHash: string } | null;
	httpsRedirect?: boolean;
	gzip?: boolean;
	noindex?: boolean;
	rawSnippet?: string | null;
}

const indentBlock = (block: string, spaces = 2) =>
	block
		.split("\n")
		.map((line) => (line.trim() ? `${" ".repeat(spaces)}${line}` : line))
		.join("\n");

export interface CaddyReverseProxyOptions {
	cloudflareProxied?: boolean;
}

export const caddySite = (hosts: string, reverseProxy: string, options?: CaddySiteOptions): string => {
	const secHeaders = options?.includeSecurityHeaders ? `\n${CADDY_SECURITY_HEADERS_BLOCK}` : "";
	const reqLimits = options?.includeRequestLimits ? `\n${CADDY_REQUEST_LIMITS_BLOCK}` : "";
	const extras: string[] = [];
	if (options?.httpsRedirect === false) {
		extras.push(`  auto_https disable_redirects`);
	}
	if (options?.gzip) {
		extras.push(`  encode gzip`);
	}
	if (options?.noindex) {
		extras.push(`  header X-Robots-Tag "noindex, nofollow"`);
	}
	if (options?.basicAuth) {
		extras.push(`  basic_auth {\n    ${options.basicAuth.username} ${options.basicAuth.passwordHash}\n  }`);
	}
	if (options?.tlsMode === "custom" && options.certificatePath && options.certificateKeyPath) {
		extras.push(`  tls ${options.certificatePath} ${options.certificateKeyPath}`);
	}
	if (options?.rawSnippet) {
		extras.push(indentBlock(options.rawSnippet));
	}
	const extra = extras.length > 0 ? `\n${extras.join("\n")}` : "";
	return `${hosts} {\n${CADDY_ACCESS_LOG_BLOCK}${secHeaders}${reqLimits}${extra}\n${reverseProxy}\n}\n`;
};

export const caddyReverseProxy = (targets: string, options?: CaddyReverseProxyOptions): string => {
	if (!options?.cloudflareProxied) return `  reverse_proxy ${targets}`;

	return `  reverse_proxy ${targets} {\n    trusted_proxies private_ranges ${CADDY_CLOUDFLARE_TRUSTED_PROXIES}\n    header_up X-Real-IP {client_ip}\n  }`;
};
