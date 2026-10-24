import type { DeployTemplate } from "../types";

export const plausibleTemplate: DeployTemplate = {
	key: "plausible",
	name: "Plausible",
	description: "Privacy-friendly web analytics, no cookies and GDPR compliant.",
	category: "analytics",
	docsUrl: "https://plausible.io/docs/self-hosting",
	service: "plausible",
	port: 8000,
	compose: `services:
  db:
    image: postgres:16-alpine
    pull_policy: always
    restart: unless-stopped
    environment:
      - POSTGRES_USER=plausible
      - POSTGRES_DB=plausible
      - POSTGRES_PASSWORD={POSTGRES_PASSWORD}
    volumes:
      - plausible-db:/var/lib/postgresql/data
  events-db:
    image: clickhouse/clickhouse-server:24.12-alpine
    pull_policy: always
    restart: unless-stopped
    environment:
      - CLICKHOUSE_USER=plausible
      - CLICKHOUSE_PASSWORD={CLICKHOUSE_PASSWORD}
      - CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1
    volumes:
      - plausible-events:/var/lib/clickhouse
      - plausible-events-user:/etc/clickhouse-users
      - plausible-events-logs:/etc/clickhouse-server/server_logs
  plausible:
    image: ghcr.io/plausible/community-edition:latest
    pull_policy: always
    restart: unless-stopped
    depends_on:
      - db
      - events-db
    command: sh -c "sleep 10 && /entrypoint.sh db createdb && /entrypoint.sh db migrate && /entrypoint.sh run"
    environment:
      - BASE_URL={BASE_URL}
      - SECRET_KEY_BASE={SECRET_KEY_BASE}
      - DATABASE_URL=postgres://plausible:{POSTGRES_PASSWORD}@db:5432/plausible
      - CLICKHOUSE_DATABASE_URL=http://events-db:8123/plausible_events_db
      - CLICKHOUSE_DATABASE_USER=plausible
      - CLICKHOUSE_DATABASE_PASSWORD={CLICKHOUSE_PASSWORD}
volumes:
  plausible-db:
  plausible-events:
  plausible-events-user:
  plausible-events-logs:
`,
	vars: [
		{
			key: "POSTGRES_PASSWORD",
			label: "Database password",
			secret: true,
		},
		{
			key: "CLICKHOUSE_PASSWORD",
			label: "Events database password",
			secret: true,
		},
		{
			key: "SECRET_KEY_BASE",
			label: "Secret key",
			description: "Server-side secret used to sign sessions and tokens.",
			secret: true,
		},
		{
			key: "BASE_URL",
			label: "Base URL",
			default: "http://localhost",
			description:
				"Public URL of the Plausible dashboard, e.g. https://plausible.example.com. Update after deploy if your domain differs.",
		},
	],
};
