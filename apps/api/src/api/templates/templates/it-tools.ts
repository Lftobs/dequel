import type { DeployTemplate } from "../types";

export const itToolsTemplate: DeployTemplate = {
	key: "it-tools",
	name: "IT Tools",
	description: "Collection of handy online tools for developers, all in one place.",
	category: "developer",
	docsUrl: "https://github.com/CorentinTh/it-tools",
	service: "it-tools",
	port: 80,
	compose: `services:
  it-tools:
    image: corentinth/it-tools:latest
    pull_policy: always
    restart: unless-stopped
`,
	vars: [],
};
