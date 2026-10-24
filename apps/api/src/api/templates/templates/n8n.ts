import type { DeployTemplate } from "../types";

export const n8nTemplate: DeployTemplate = {
	key: "n8n",
	name: "n8n",
	description: "Workflow automation platform. Self-hosted alternative to Zapier.",
	category: "automation",
	docsUrl: "https://docs.n8n.io/hosting/",
	service: "n8n",
	port: 5678,
	compose: `services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    pull_policy: always
    restart: unless-stopped
    environment:
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - N8N_ENCRYPTION_KEY={N8N_ENCRYPTION_KEY}
      - GENERIC_TIMEZONE={GENERIC_TIMEZONE}
    volumes:
      - n8n-data:/home/node/.n8n
volumes:
  n8n-data:
`,
	vars: [
		{
			key: "N8N_ENCRYPTION_KEY",
			label: "Encryption key",
			description: "Used to encrypt credentials stored in n8n. Changing it after first run breaks stored credentials.",
			secret: true,
		},
		{ key: "GENERIC_TIMEZONE", label: "Timezone", default: "UTC" },
	],
};
