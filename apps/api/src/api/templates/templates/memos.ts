import type { DeployTemplate } from "../types";

export const memosTemplate: DeployTemplate = {
	key: "memos",
	name: "Memos",
	description: "Lightweight note-taking service, like a private stream of your thoughts.",
	category: "productivity",
	docsUrl: "https://github.com/usememos/memos",
	service: "memos",
	port: 5230,
	compose: `services:
  memos:
    image: neosmemo/memos:stable
    pull_policy: always
    restart: unless-stopped
    volumes:
      - memos-data:/var/opt/memos
volumes:
  memos-data:
`,
	vars: [],
};
