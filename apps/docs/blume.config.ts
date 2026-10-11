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
			{
				label: "Projects",
				items: [
					"/docs/deployments",
					"/docs/configuration",
					"/docs/env-vars",
					"/docs/shared-env-vars",
					"/docs/volumes",
					"/docs/domains",
					"/docs/scaling",
				],
			},
			{
				label: "Data",
				items: ["/docs/databases", "/docs/backups"],
			},
			{
				label: "Multi-Server",
				items: ["/docs/servers", "/docs/agent-caddy-routes"],
			},
			{
				label: "AI & Diagnosis",
				items: ["/docs/ai-diagnosis"],
			},
			{
				label: "Observability",
				items: ["/docs/observability", "/docs/alerts"],
			},
			{
				label: "Integrations",
				items: ["/docs/github", "/docs/settings"],
			},
			{
				label: "Security",
				items: ["/docs/auth", "/docs/keys", "/docs/ssl"],
			},
			{
				label: "Platform",
				items: ["/docs/system-config", "/docs/cli"],
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
