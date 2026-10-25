import type { DeployTemplate } from "../types";

export const paperlessNgxTemplate: DeployTemplate = {
	key: "paperless-ngx",
	name: "Paperless-ngx",
	description: "Document management with OCR, full-text search and automatic tagging.",
	category: "productivity",
	docsUrl: "https://docs.paperless-ngx.com/",
	service: "webserver",
	port: 8000,
	compose: `services:
  broker:
    image: redis:7
    pull_policy: always
    restart: unless-stopped
  gotenberg:
    image: gotenberg/gotenberg:8
    pull_policy: always
    restart: unless-stopped
    command:
      - gotenberg
      - --chromium-disable-routes=1
  tika:
    image: apache/tika:latest
    pull_policy: always
    restart: unless-stopped
  db:
    image: postgres:16
    pull_policy: always
    restart: unless-stopped
    environment:
      - POSTGRES_DB=paperless
      - POSTGRES_USER=paperless
      - POSTGRES_PASSWORD={PAPERLESS_DB_PASSWORD}
    volumes:
      - paperless-db:/var/lib/postgresql/data
  webserver:
    image: ghcr.io/paperless-ngx/paperless-ngx:latest
    pull_policy: always
    restart: unless-stopped
    depends_on:
      - broker
      - gotenberg
      - tika
      - db
    environment:
      - PAPERLESS_REDIS=redis://broker:6379
      - PAPERLESS_DBHOST=db
      - PAPERLESS_DBNAME=paperless
      - PAPERLESS_DBUSER=paperless
      - PAPERLESS_DBPASS={PAPERLESS_DB_PASSWORD}
      - PAPERLESS_SECRET_KEY={PAPERLESS_SECRET_KEY}
      - PAPERLESS_TIME_ZONE={TIME_ZONE}
      - PAPERLESS_TIKA_ENABLED=1
      - PAPERLESS_TIKA_ENDPOINT=http://tika:9998
      - PAPERLESS_TIKA_GOTENBERG_ENDPOINT=http://gotenberg:3000
      - PAPERLESS_ADMIN_USER={ADMIN_USER}
      - PAPERLESS_ADMIN_PASSWORD={ADMIN_PASSWORD}
      - PAPERLESS_CONSUMER_POLLING=30
    volumes:
      - paperless-data:/usr/src/paperless/data
      - paperless-media:/usr/src/paperless/media
      - paperless-export:/usr/src/paperless/export
      - paperless-consume:/usr/src/paperless/consume
volumes:
  paperless-db:
  paperless-data:
  paperless-media:
  paperless-export:
  paperless-consume:
`,
	vars: [
		{
			key: "PAPERLESS_DB_PASSWORD",
			label: "Database password",
			secret: true,
		},
		{
			key: "PAPERLESS_SECRET_KEY",
			label: "Secret key",
			description: "Django secret used for session signing and password resets.",
			secret: true,
		},
		{
			key: "ADMIN_USER",
			label: "Admin username",
			default: "admin",
		},
		{
			key: "ADMIN_PASSWORD",
			label: "Admin password",
			description: "Used to auto-create the first Paperless account on startup.",
			secret: true,
		},
		{
			key: "TIME_ZONE",
			label: "Timezone",
			default: "UTC",
			description: "IANA timezone, e.g. Europe/Berlin. Used for date display and document dating.",
		},
	],
};
