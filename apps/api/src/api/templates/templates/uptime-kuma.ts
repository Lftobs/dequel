import type { DeployTemplate } from "../types";

export const uptimeKumaTemplate: DeployTemplate = {
	key: "uptime-kuma",
	name: "Uptime Kuma",
	description: "Self-hosted monitoring tool with status pages and alerts.",
	category: "monitoring",
	docsUrl: "https://github.com/louislam/uptime-kuma",
	service: "uptime-kuma",
	port: 3001,
	compose: `services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    pull_policy: always
    restart: unless-stopped
    volumes:
      - uptime-kuma-data:/app/data
volumes:
  uptime-kuma-data:
`,
	vars: [],
};
