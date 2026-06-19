import { config } from "./config";

interface GrafanaDashboard {
	dashboard: {
		title: string;
		uid: string;
		tags: string[];
		schemaVersion: number;
		version: number;
		timezone: string;
		refresh: string;
		panels: unknown[];
	};
	overwrite: boolean;
}

let sessionCookie: string | null = null;
let sessionExpires = 0;

async function grafanaLogin(): Promise<string | null> {
	if (sessionCookie && Date.now() < sessionExpires) {
		return sessionCookie;
	}
	try {
		const res = await fetch(`${config.grafanaUrl}/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				user: config.grafanaUser,
				password: config.grafanaPass,
			}),
		});
		const setCookie = res.headers.get("set-cookie");
		if (!setCookie) return null;
		sessionCookie = setCookie.split(";")[0];
		sessionExpires = Date.now() + 60 * 60 * 1000;
		return sessionCookie;
	} catch {
		return null;
	}
}

async function grafanaPost(
	path: string,
	body: unknown,
): Promise<unknown | null> {
	const cookie = await grafanaLogin();
	if (!cookie) return null;
	try {
		const res = await fetch(`${config.grafanaUrl}/api${path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: cookie,
			},
			body: JSON.stringify(body),
		});
		return await res.json();
	} catch {
		return null;
	}
}

export async function ensureProjectDashboard(
	projectName: string,
	containerRegex: string,
): Promise<void> {
	const slug = projectName
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 63);

	const dashboard: GrafanaDashboard = {
		dashboard: {
			title: `Dequel \u2014 ${projectName}`,
			uid: `dequel-project-${slug}`,
			tags: ["dequel", "project", slug],
			schemaVersion: 39,
			version: 1,
			timezone: "browser",
			refresh: "30s",
			panels: [
				{
					type: "row",
					title: "Resource Usage",
					collapsed: false,
					gridPos: { h: 1, w: 24, x: 0, y: 0 },
				},
				{
					id: 1,
					type: "timeseries",
					title: "CPU Usage",
					datasource: { type: "prometheus", uid: "prometheus" },
					gridPos: { h: 9, w: 12, x: 0, y: 1 },
					fieldConfig: {
						defaults: {
							unit: "short",
							custom: {
								stacking: { mode: "normal" },
								fillOpacity: 30,
								lineWidth: 1,
							},
						},
						overrides: [],
					},
					options: {
						legend: {
							displayMode: "table",
							placement: "right",
							showLegend: true,
						},
						tooltip: { mode: "multi" },
					},
					targets: [
						{
							datasource: { type: "prometheus", uid: "prometheus" },
							expr: `rate(container_cpu_usage_seconds_total{name=~"${containerRegex}"}[$__rate_interval])`,
							legendFormat: "{{name}}",
							refId: "A",
						},
					],
				},
				{
					id: 2,
					type: "timeseries",
					title: "Memory Usage",
					datasource: { type: "prometheus", uid: "prometheus" },
					gridPos: { h: 9, w: 12, x: 12, y: 1 },
					fieldConfig: {
						defaults: {
							unit: "bytes",
							custom: {
								stacking: { mode: "normal" },
								fillOpacity: 30,
								lineWidth: 1,
							},
						},
						overrides: [],
					},
					options: {
						legend: {
							displayMode: "table",
							placement: "right",
							showLegend: true,
						},
						tooltip: { mode: "multi" },
					},
					targets: [
						{
							datasource: { type: "prometheus", uid: "prometheus" },
							expr: `container_memory_working_set_bytes{name=~"${containerRegex}"}`,
							legendFormat: "{{name}}",
							refId: "A",
						},
					],
				},
				{
					type: "row",
					title: "Request Metrics",
					collapsed: false,
					gridPos: { h: 1, w: 24, x: 0, y: 10 },
				},
				{
					id: 4,
					type: "timeseries",
					title: "Request Rate",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 9, w: 24, x: 0, y: 11 },
					fieldConfig: {
						defaults: {
							unit: "reqps",
							custom: {
								fillOpacity: 30,
								lineWidth: 1,
							},
						},
						overrides: [],
					},
					options: {
						legend: {
							displayMode: "table",
							placement: "right",
							showLegend: true,
						},
						tooltip: { mode: "multi" },
					},
					targets: [
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `sum by(host) (count_over_time({container=~"${containerRegex}"} | json [5m]))`,
							legendFormat: "{{host}}",
							refId: "A",
						},
					],
				},
				{
					type: "row",
					title: "Logs",
					collapsed: false,
					gridPos: { h: 1, w: 24, x: 0, y: 20 },
				},
				{
					id: 3,
					type: "logs",
					title: "Container Logs",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 12, w: 24, x: 0, y: 21 },
					options: {
						showLabels: true,
						showTime: true,
						wrapLogMessage: true,
						enableLogDetails: true,
						dedupStrategy: "none",
					},
					targets: [
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `{container=~"${containerRegex}"}`,
							refId: "A",
						},
					],
				},
			],
		},
		overwrite: true,
	};

	const result = await grafanaPost("/dashboards/db", dashboard);
	if (result) {
		console.log(
			`[Grafana] Dashboard created/updated for ${projectName}`,
		);
	} else {
		console.warn(
			`[Grafana] Failed to create dashboard for ${projectName}`,
		);
	}
}
