import { config } from "./config";
import { listDomains } from "../db/repo";

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
	projectId: string,
	projectName: string,
	containerRegex: string,
): Promise<void> {
	const slug = projectName
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 63);

	const domains = [`${slug}.${config.caddyBaseDomain}`];
	try {
		const projectDomains = await listDomains(projectId);
		const verified = projectDomains.filter(d => d.validationStatus === 'verified');
		for (const d of verified) {
			domains.push(d.domain);
		}
	} catch (e) {
		console.warn("[Grafana] Failed to list domains for dashboard query:", e);
	}

	const regexEscaped = domains.map(d => d.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\\\$&')).join('|');

	const dashboard: GrafanaDashboard = {
		dashboard: {
			title: `Dequel \u2014 ${projectName}`,
			uid: `dequel-project-${slug}`,
			tags: ["dequel", "project", slug],
			schemaVersion: 39,
			version: 1,
			timezone: "browser",
			refresh: "10s",
			panels: [
				{
					type: "row",
					title: "Overview",
					collapsed: false,
					gridPos: { h: 1, w: 24, x: 0, y: 0 },
				},
				{
					id: 5,
					type: "stat",
					title: "Requests (period)",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 3, w: 3, x: 0, y: 1 },
					fieldConfig: {
						defaults: {
							unit: "none",
							color: { mode: "fixed" },
							fixedColor: "blue"
						}
					},
					options: {
						graphMode: "area",
						reduceOptions: { calcs: ["lastNotNull"] }
					},
					targets: [
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `sum(count_over_time({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" [$__range]))`,
							refId: "A"
						}
					]
				},
				{
					id: 6,
					type: "stat",
					title: "% Success",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 3, w: 3, x: 3, y: 1 },
					fieldConfig: {
						defaults: {
							unit: "percent",
							color: { mode: "thresholds" },
							thresholds: {
								mode: "absolute",
								steps: [
									{ color: "red", value: null },
									{ color: "yellow", value: 90 },
									{ color: "green", value: 95 }
								]
							}
						}
					},
					options: {
						graphMode: "area",
						reduceOptions: { calcs: ["lastNotNull"] }
					},
					targets: [
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `(sum(count_over_time({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" | status >= 100 and status < 400 [$__range])) / sum(count_over_time({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" [$__range])) * 100) or 0`,
							refId: "A"
						}
					]
				},
				{
					id: 7,
					type: "stat",
					title: "Avg Latency",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 3, w: 3, x: 6, y: 1 },
					fieldConfig: {
						defaults: {
							unit: "s",
							color: { mode: "thresholds" },
							thresholds: {
								mode: "absolute",
								steps: [
									{ color: "green", value: null },
									{ color: "yellow", value: 0.5 },
									{ color: "red", value: 2.0 }
								]
							}
						}
					},
					options: {
						graphMode: "area",
						reduceOptions: { calcs: ["lastNotNull"] }
					},
					targets: [
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `avg_over_time({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" | unwrap duration [$__range])`,
							refId: "A"
						}
					]
				},
				{
					id: 8,
					type: "stat",
					title: "Reqs (2m)",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 3, w: 3, x: 9, y: 1 },
					fieldConfig: {
						defaults: {
							unit: "none",
							color: { mode: "fixed" },
							fixedColor: "blue"
						}
					},
					options: {
						graphMode: "line",
						reduceOptions: { calcs: ["lastNotNull"] }
					},
					targets: [
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `sum(count_over_time({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" [2m]))`,
							refId: "A"
						}
					]
				},
				{
					id: 9,
					type: "stat",
					title: "% Success (2m)",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 3, w: 3, x: 12, y: 1 },
					fieldConfig: {
						defaults: {
							unit: "percent",
							color: { mode: "thresholds" },
							thresholds: {
								mode: "absolute",
								steps: [
									{ color: "red", value: null },
									{ color: "yellow", value: 90 },
									{ color: "green", value: 95 }
								]
							}
						}
					},
					options: {
						graphMode: "area",
						reduceOptions: { calcs: ["lastNotNull"] }
					},
					targets: [
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `(sum(count_over_time({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" | status >= 100 and status < 400 [2m])) / sum(count_over_time({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" [2m])) * 100) or 0`,
							refId: "A"
						}
					]
				},
				{
					id: 10,
					type: "stat",
					title: "HTTP 1/2xx (2m)",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 3, w: 2, x: 15, y: 1 },
					fieldConfig: {
						defaults: {
							unit: "none",
							color: { mode: "fixed" },
							fixedColor: "green"
						}
					},
					options: {
						graphMode: "line",
						reduceOptions: { calcs: ["lastNotNull"] }
					},
					targets: [
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `sum(count_over_time({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" | status >= 100 and status < 300 [2m]))`,
							refId: "A"
						}
					]
				},
				{
					id: 11,
					type: "stat",
					title: "HTTP 3xx (2m)",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 3, w: 2, x: 17, y: 1 },
					fieldConfig: {
						defaults: {
							unit: "none",
							color: { mode: "fixed" },
							fixedColor: "orange"
						}
					},
					options: {
						graphMode: "line",
						reduceOptions: { calcs: ["lastNotNull"] }
					},
					targets: [
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `sum(count_over_time({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" | status >= 300 and status < 400 [2m]))`,
							refId: "A"
						}
					]
				},
				{
					id: 12,
					type: "stat",
					title: "HTTP 4xx (2m)",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 3, w: 2.5, x: 19, y: 1 },
					fieldConfig: {
						defaults: {
							unit: "none",
							color: { mode: "fixed" },
							fixedColor: "yellow"
						}
					},
					options: {
						graphMode: "line",
						reduceOptions: { calcs: ["lastNotNull"] }
					},
					targets: [
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `sum(count_over_time({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" | status >= 400 and status < 500 [2m]))`,
							refId: "A"
						}
					]
				},
				{
					id: 13,
					type: "stat",
					title: "HTTP 5xx (2m)",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 3, w: 2.5, x: 21.5, y: 1 },
					fieldConfig: {
						defaults: {
							unit: "none",
							color: { mode: "fixed" },
							fixedColor: "red"
						}
					},
					options: {
						graphMode: "line",
						reduceOptions: { calcs: ["lastNotNull"] }
					},
					targets: [
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `sum(count_over_time({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" | status >= 500 [2m]))`,
							refId: "A"
						}
					]
				},
				{
					type: "row",
					title: "HTTP Ingress Performance",
					collapsed: false,
					gridPos: { h: 1, w: 24, x: 0, y: 4 },
				},
				{
					id: 14,
					type: "timeseries",
					title: "HTTP Requests / Ingress",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 8, w: 8, x: 0, y: 5 },
					fieldConfig: {
						defaults: {
							unit: "reqps",
							custom: { fillOpacity: 10, lineWidth: 1.5 }
						}
					},
					targets: [
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `sum(rate({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" [$__interval])) by (request_host)`,
							legendFormat: "{{request_host}}",
							refId: "A"
						}
					]
				},
				{
					id: 15,
					type: "timeseries",
					title: "HTTP Status Codes",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 8, w: 8, x: 8, y: 5 },
					fieldConfig: {
						defaults: {
							unit: "reqps",
							custom: { fillOpacity: 10, lineWidth: 1.5 }
						}
					},
					targets: [
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `sum(rate({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" [$__interval])) by (status)`,
							legendFormat: "HTTP {{status}}",
							refId: "A"
						}
					]
				},
				{
					id: 16,
					type: "timeseries",
					title: "Total HTTP Requests",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 8, w: 8, x: 16, y: 5 },
					fieldConfig: {
						defaults: {
							unit: "none",
							custom: { fillOpacity: 25, lineWidth: 1 }
						}
					},
					targets: [
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `sum(count_over_time({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" [$__interval]))`,
							legendFormat: "Requests",
							refId: "A"
						}
					]
				},
				{
					type: "row",
					title: "Latency",
					collapsed: false,
					gridPos: { h: 1, w: 24, x: 0, y: 13 },
				},
				{
					id: 17,
					type: "timeseries",
					title: "Latency (Average Percentiles)",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 8, w: 12, x: 0, y: 14 },
					fieldConfig: {
						defaults: {
							unit: "s",
							custom: { fillOpacity: 10, lineWidth: 1.5 }
						}
					},
					targets: [
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `quantile_over_time(0.99, {container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" | unwrap duration [$__interval])`,
							legendFormat: "p99",
							refId: "A"
						},
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `quantile_over_time(0.95, {container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" | unwrap duration [$__interval])`,
							legendFormat: "p95",
							refId: "B"
						},
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `quantile_over_time(0.50, {container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" | unwrap duration [$__interval])`,
							legendFormat: "p50 (median)",
							refId: "C"
						},
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `avg_over_time({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" | unwrap duration [$__interval])`,
							legendFormat: "Average",
							refId: "D"
						}
					]
				},
				{
					id: 18,
					type: "heatmap",
					title: "Latency Heatmap",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 8, w: 12, x: 12, y: 14 },
					targets: [
						{
							datasource: { type: "loki", uid: "loki" },
							expr: `log_histogram({container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" | unwrap duration [$__interval])`,
							refId: "A"
						}
					]
				},
				{
					type: "row",
					title: "Resource Usage",
					collapsed: false,
					gridPos: { h: 1, w: 24, x: 0, y: 22 },
				},
				{
					id: 1,
					type: "timeseries",
					title: "CPU Usage",
					datasource: { type: "prometheus", uid: "prometheus" },
					gridPos: { h: 8, w: 12, x: 0, y: 23 },
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
					gridPos: { h: 8, w: 12, x: 12, y: 23 },
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
					title: "Logs & Troubleshooting",
					collapsed: false,
					gridPos: { h: 1, w: 24, x: 0, y: 31 },
				},
				{
					id: 19,
					type: "logs",
					title: "HTTP Request Error Logs",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 10, w: 12, x: 0, y: 32 },
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
							expr: `{container="dequel-caddy-1"} | json | request_host =~ "^(${regexEscaped})$" | status >= 400`,
							refId: "A",
						},
					],
				},
				{
					id: 3,
					type: "logs",
					title: "Application Container Logs",
					datasource: { type: "loki", uid: "loki" },
					gridPos: { h: 10, w: 12, x: 12, y: 32 },
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
