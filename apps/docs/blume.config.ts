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
	feedback: false,
	theme: {
		accent: "orange",
		mode: "dark",
		radius: "md",
		fonts: {
			display: "space-grotesk",
			body: "dm-sans",
			mono: "jetbrains-mono",
		},
	},
	navigation: {
		actions: [{ href: "/", label: "HOME" }],
		cta: { href: "/docs/installation", label: "INSTALL →" },
		sidebar: [
			"/docs",
			"/docs/installation",
			"/docs/quickstart",
			"/docs/configuration",
			{
				label: "Core Architecture",
				items: ["/docs/deployments", "/docs/env-vars", "/docs/scaling", "/docs/system-config"],
			},
			{
				label: "Deployment",
				items: ["/docs/ai-diagnosis", "/docs/agent-caddy-routes"],
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
