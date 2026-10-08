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
}

export interface CaddyReverseProxyOptions {
	cloudflareProxied?: boolean;
}

export const caddySite = (hosts: string, reverseProxy: string, options?: CaddySiteOptions): string => {
	const secHeaders = options?.includeSecurityHeaders ? `\n${CADDY_SECURITY_HEADERS_BLOCK}` : "";
	const reqLimits = options?.includeRequestLimits ? `\n${CADDY_REQUEST_LIMITS_BLOCK}` : "";
	return `${hosts} {\n${CADDY_ACCESS_LOG_BLOCK}${secHeaders}${reqLimits}\n${reverseProxy}\n}\n`;
};

export const caddyReverseProxy = (targets: string, options?: CaddyReverseProxyOptions): string => {
	const trustedProxies = options?.cloudflareProxied
		? `\n    trusted_proxies private_ranges ${CADDY_CLOUDFLARE_TRUSTED_PROXIES}\n    header_up X-Real-IP {client_ip}`
		: "";

	return `  reverse_proxy ${targets} {\n    header_up Host {upstream_hostport}${trustedProxies}\n  }`;
};
