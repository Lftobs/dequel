import type { DeployTemplate } from "../types";

export const vaultwardenTemplate: DeployTemplate = {
	key: "vaultwarden",
	name: "Vaultwarden",
	description: "Lightweight password manager compatible with Bitwarden clients.",
	category: "security",
	docsUrl: "https://github.com/dani-garcia/vaultwarden",
	service: "vaultwarden",
	port: 80,
	compose: `services:
  vaultwarden:
    image: vaultwarden/server:latest
    pull_policy: always
    restart: unless-stopped
    environment:
      - ADMIN_TOKEN={ADMIN_TOKEN}
      - SIGNUPS_ALLOWED={SIGNUPS_ALLOWED}
    volumes:
      - vaultwarden-data:/data
volumes:
  vaultwarden-data:
`,
	vars: [
		{
			key: "ADMIN_TOKEN",
			label: "Admin panel token",
			description:
				"Token used to access the /admin panel. Keep it secret or flip SIGNUPS_ALLOWED down once accounts exist.",
			secret: true,
		},
		{
			key: "SIGNUPS_ALLOWED",
			label: "Allow public signups",
			default: "true",
			description: "Set to false to stop new account registrations once your accounts exist.",
		},
	],
};
