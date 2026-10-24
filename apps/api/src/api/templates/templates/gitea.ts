import type { DeployTemplate } from "../types";

export const giteaTemplate: DeployTemplate = {
	key: "gitea",
	name: "Gitea",
	description: "Lightweight self-hosted Git service with issues, pulls and CI.",
	category: "developer",
	docsUrl: "https://docs.gitea.com/next/installation/install-with-docker",
	service: "gitea",
	port: 3000,
	compose: `services:
  gitea:
    image: gitea/gitea:1
    pull_policy: always
    restart: unless-stopped
    environment:
      - USER_UID=1000
      - USER_GID=1000
      - GITEA__server__DISABLE_SSH=true
      - GITEA__server__HTTP_PORT=3000
      - GITEA__server__ROOT_URL={ROOT_URL}
      - GITEA__database__DB_TYPE=sqlite3
      - GITEA__database__PATH=/data/gitea/gitea.db
    volumes:
      - gitea-data:/data
volumes:
  gitea-data:
`,
	vars: [
		{
			key: "ROOT_URL",
			label: "Instance URL",
			default: "http://localhost",
			description: "Public URL of this Gitea instance, e.g. https://git.example.com. Used for links and SSH/web URLs.",
		},
	],
};
