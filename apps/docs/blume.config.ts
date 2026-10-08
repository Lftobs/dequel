import { defineConfig } from "blume";
import { z } from "zod";

export default defineConfig({
	title: "Dequel",
	description:
		"Self-hosted PaaS container platform. Deploy apps from Git, ZIP, or Docker Compose with zero infrastructure setup.",
	basePath: "/docs",
	logo: "/logo.svg",
	content: {
		root: "docs",
	},
	frontmatter: {
		extend: {
			category: z.string().optional(),
		},
	},
	theme: {
		accent: "orange",
		mode: "dark",
		radius: "md",
	},
	navigation: {
		actions: [{ href: "https://github.com/Lftobs/dequel", label: "GitHub" }],
		sidebar: [
			{
				label: "Getting Started",
				items: ["/docs", "/docs/control-plane", "/docs/installation", "/docs/quickstart", "/docs/configuration"],
			},
			{
				label: "Core Architecture",
				items: ["/docs/deployments", "/docs/agent-caddy-routes", "/docs/env-vars"],
			},
			{
				label: "Deployment",
				items: ["/docs/scaling", "/docs/ai-diagnosis", "/docs/system-config"],
			},
			{
				label: "Cluster Storage & Data",
				items: ["/docs/databases", "/docs/volumes"],
			},
			{
				label: "Networking & Security",
				items: ["/docs/auth", "/docs/domains", "/docs/ssl"],
			},
			{
				label: "Release",
				items: ["/docs/changelog"],
			},
		],
	},
	deployment: {
		site: "https://dequel.intrep.xyz",
	},
});
