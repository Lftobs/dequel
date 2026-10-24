import type { DeployTemplate } from "../types";

export const nextcloudTemplate: DeployTemplate = {
	key: "nextcloud",
	name: "Nextcloud",
	description: "Files, calendar, contacts and collaboration, self-hosted in one place.",
	category: "storage",
	docsUrl: "https://docs.nextcloud.com/server/latest/admin_manual/installation/docker_install_config.html",
	service: "nextcloud",
	port: 80,
	compose: `services:
  db:
    image: postgres:17-alpine
    pull_policy: always
    restart: unless-stopped
    environment:
      - POSTGRES_DB=nextcloud
      - POSTGRES_USER=nextcloud
      - POSTGRES_PASSWORD={NEXTCLOUD_DB_PASSWORD}
    volumes:
      - nextcloud-db:/var/lib/postgresql/data
  nextcloud:
    image: nextcloud:35-apache
    pull_policy: always
    restart: unless-stopped
    depends_on:
      - db
    environment:
      - POSTGRES_HOST=db
      - POSTGRES_DB=nextcloud
      - POSTGRES_USER=nextcloud
      - POSTGRES_PASSWORD={NEXTCLOUD_DB_PASSWORD}
      - NEXTCLOUD_TRUSTED_DOMAINS={TRUSTED_DOMAINS}
    volumes:
      - nextcloud-data:/var/www/html
volumes:
  nextcloud-db:
  nextcloud-data:
`,
	vars: [
		{
			key: "NEXTCLOUD_DB_PASSWORD",
			label: "Database password",
			secret: true,
		},
		{
			key: "TRUSTED_DOMAINS",
			label: "Trusted domains",
			default: "localhost",
			description:
				"Space-separated list of domains allowed to use this Nextcloud, e.g. mycloud.example.com. Include your Dequel domain here.",
		},
	],
};
