export const CADDY_ACCESS_LOG_BLOCK = `  log {
    output stdout
    format json
  }`;

export const caddySite = (hosts: string, reverseProxy: string): string =>
	`${hosts} {\n${CADDY_ACCESS_LOG_BLOCK}\n${reverseProxy}\n}\n`;

export const caddyReverseProxy = (targets: string): string =>
	`  reverse_proxy ${targets} {\n    header_up Host {upstream_hostport}\n  }`;
