import type { DeployTemplate } from "../types";

export const umamiTemplate: DeployTemplate = {
	key: "umami",
	name: "Umami",
	description: "Simple, privacy-focused web analytics with a clean dashboard.",
	category: "analytics",
	docsUrl: "https://umami.is/docs",
	service: "umami",
	port: 3000,
	compose: `services:
  db:
    image: postgres:15-alpine
    pull_policy: always
    restart: unless-stopped
    environment:
      - POSTGRES_DB=umami
      - POSTGRES_USER=umami
      - POSTGRES_PASSWORD={UMAMI_DB_PASSWORD}
    volumes:
      - umami-db:/var/lib/postgresql/data
  umami:
    image: ghcr.io/umami-software/umami:latest
    pull_policy: always
    restart: unless-stopped
    depends_on:
      - db
    environment:
      - DATABASE_TYPE=postgresql
      - DATABASE_URL=postgresql://umami:{UMAMI_DB_PASSWORD}@db:5432/umami
      - APP_SECRET={APP_SECRET}
volumes:
  umami-db:
`,
	vars: [
		{
			key: "UMAMI_DB_PASSWORD",
			label: "Database password",
			secret: true,
		},
		{
			key: "APP_SECRET",
			label: "Session secret",
			description: "Used by Umami to sign session cookies and tokens.",
			secret: true,
		},
	],
};
