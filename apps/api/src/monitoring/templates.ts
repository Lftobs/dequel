import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ScalingSuggestion } from "./alert-guard";

export interface AlertDetails {
	containers?: { name: string; value: number }[];
	lastRunningAt?: string | null;
	logsUrl?: string;
	appUrl?: string;
	projectUrl?: string;
	scaling?: (ScalingSuggestion & { url: string }) | null;
}

export const EMAIL_ATTACHMENTS = [
	{
		filename: "logo.webp",
		path: join(import.meta.dir, "templates", "logo.webp"),
		cid: "dequel-logo",
	},
];

const THEME = {
	cardBorder: "#e4e4e7",
	text: "#18181b",
	textMuted: "#71717a",
	accent: "#ea580c",
	link: "#7c3aed",
	red: "#dc2626",
	redBg: "#fef2f2",
	amber: "#d97706",
	amberBg: "#fff7ed",
	green: "#059669",
	greenBg: "#ecfdf5",
};

const loadHtml = (filename: string): string => {
	const filepath = join(import.meta.dir, "templates", filename);
	return readFileSync(filepath, "utf-8");
};

const layoutHtml = loadHtml("layout.html");
const deployFailureTpl = loadHtml("deploy-failure.html");
const alertMetricTpl = loadHtml("alert-metric.html");
const alertDowntimeTpl = loadHtml("alert-downtime.html");
const alertCertExpiryTpl = loadHtml("alert-cert-expiry.html");
const alertDefaultTpl = loadHtml("alert-default.html");
const smtpTestTpl = loadHtml("smtp-test.html");

const truncated = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n)}…` : s);

const escapeHtml = (s: string): string =>
	s.replace(/[&<>"']/g, (c) =>
		c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
	);

const renderBadge = (text: string, bg: string, textColor: string) => {
	if (!text) return "";
	return `<div style="margin-bottom:20px;">
    <span style="display:inline-block;background:${bg};color:${textColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;padding:4px 10px;border-radius:4px;border:1px solid ${textColor}33;">${text}</span>
  </div>`;
};

const renderButton = (href?: string, text?: string) => {
	if (!href || !text) return "";
	return `<div style="margin-top:24px;margin-bottom:24px;text-align:center;">
    <a href="${href}" style="display:inline-block;background:#ffffff;border:1.5px solid #18181b;color:#18181b;padding:10px 24px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.2px;box-shadow:0 1px 2px rgba(0,0,0,0.05);">${text}</a>
  </div>`;
};

const renderRow = (label: string, value: string) => `
  <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid ${THEME.cardBorder};">
    <span style="color:${THEME.textMuted};font-size:13px;">${label}</span>
    <span style="color:${THEME.text};font-size:13px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;text-align:right;max-width:300px;word-break:break-all;">${value}</span>
  </div>`;

const renderScalingSuggestion = (s: AlertDetails["scaling"]): string => {
	if (!s) return "";
	const enable = s.kind === "enable_autoscaling";
	const title = enable ? "Autoscaling is off" : "Replica limit reached";
	const text = enable
		? "Enable autoscaling for this project and Dequel will add capacity automatically while load stays high."
		: `This project is at its replica limit (${s.current}/${s.maxReplicas}). Raise max replicas so autoscaling can add capacity.`;
	const cta = enable ? "Set up autoscaling" : "Adjust scaling";
	return `<div style="background:${THEME.amberBg};border:1px solid ${THEME.amber}44;border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
    <div style="color:${THEME.text};font-size:14px;font-weight:700;margin-bottom:6px;">${title}</div>
    <div style="color:${THEME.textMuted};font-size:13px;line-height:1.5;margin-bottom:4px;">${text}</div>
    <a href="${s.url}" style="display:inline-block;margin-top:12px;background:#ffffff;border:1.5px solid #18181b;color:#18181b;padding:8px 20px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:600;">${cta}</a>
  </div>`;
};

const renderShell = (badgeText: string, badgeBg: string, badgeTextColor: string, bodyContent: string): string => {
	const badgeHtml = renderBadge(badgeText, badgeBg, badgeTextColor);
	return layoutHtml.replace("{{BADGE_HTML}}", badgeHtml).replace("{{BODY_CONTENT}}", bodyContent);
};

export const buildEmail = (
	alertType: string,
	projectName: string,
	threshold: number | null,
	currentValue: number,
	details?: AlertDetails,
): { subject: string; html: string } => {
	const project = escapeHtml(projectName);
	switch (alertType) {
		case "cpu":
		case "memory": {
			const isCpu = alertType === "cpu";
			const unit = "%";
			const containers = details?.containers ?? [];
			const containerRows = containers.map((c) => renderRow(c.name, `${c.value.toFixed(1)}${unit}`)).join("");
			const actionButton = details?.appUrl ? renderButton(details.appUrl, "View Application") : "";

			const body = alertMetricTpl
				.replace(/{{METRIC_TYPE}}/g, isCpu ? "CPU" : "Memory")
				.replace(/{{PROJECT_NAME}}/g, project)
				.replace(/{{CURRENT_VALUE}}/g, currentValue.toFixed(1))
				.replace(/{{THRESHOLD}}/g, String(threshold ?? "N/A"))
				.replace(/{{UNIT}}/g, unit)
				.replace("{{CONTAINER_ROWS}}", containerRows)
				.replace("{{SCALING_HTML}}", renderScalingSuggestion(details?.scaling))
				.replace("{{ACTION_BUTTON}}", actionButton);

			return {
				subject: `${isCpu ? "High CPU" : "High memory"} on ${projectName} (${currentValue.toFixed(0)}${unit})`,
				html: renderShell(isCpu ? "CPU ALERT" : "MEMORY ALERT", THEME.amberBg, THEME.amber, body),
			};
		}

		case "downtime": {
			const lastRunningRow = details?.lastRunningAt
				? renderRow("Last running", new Date(details.lastRunningAt).toUTCString())
				: "";
			const actionButton = details?.logsUrl ? renderButton(details.logsUrl, "View Logs") : "";

			const body = alertDowntimeTpl
				.replace(/{{PROJECT_NAME}}/g, project)
				.replace("{{LAST_RUNNING_ROW}}", lastRunningRow)
				.replace("{{ACTION_BUTTON}}", actionButton);

			return {
				subject: `${projectName} is down`,
				html: renderShell("SERVICE DOWN", THEME.redBg, THEME.red, body),
			};
		}

		case "cert_expiry": {
			const daysRow = renderRow("Days remaining", String(currentValue));
			const actionButton = details?.appUrl ? renderButton(details.appUrl, "View Site") : "";

			const body = alertCertExpiryTpl
				.replace(/{{PROJECT_NAME}}/g, project)
				.replace(/{{CURRENT_VALUE}}/g, String(currentValue))
				.replace("{{DAYS_ROW}}", daysRow)
				.replace("{{ACTION_BUTTON}}", actionButton);

			return {
				subject: `SSL certificate for ${projectName} expires in ${currentValue} days`,
				html: renderShell("CERTIFICATE EXPIRY", THEME.amberBg, THEME.amber, body),
			};
		}

		default: {
			const detailsRows = [
				renderRow("Type", alertType),
				renderRow("Threshold", threshold !== null ? String(threshold) : "N/A"),
				renderRow("Current value", String(currentValue)),
			].join("");

			const body = alertDefaultTpl.replace(/{{PROJECT_NAME}}/g, project).replace("{{DETAILS_ROWS}}", detailsRows);

			return {
				subject: `[Dequel] ${alertType} alert — ${projectName}`,
				html: renderShell("ALERT", THEME.amberBg, THEME.amber, body),
			};
		}
	}
};

export const buildDeploymentFailureEmail = (ctx: {
	projectName: string;
	failureReason: string | null;
	commitSha: string | null;
	sourceRef: string;
	finishedAt: string | null;
	logsUrl?: string;
}): { subject: string; html: string } => {
	const commitItem = ctx.commitSha
		? `<li style="margin-bottom:10px;color:#3f3f46;"><strong style="color:#18181b;">Commit:</strong> ${
				ctx.failureReason
					? `<a href="${ctx.logsUrl || "#"}" style="color:#7c3aed;text-decoration:underline;font-weight:500;">${escapeHtml(truncated(ctx.failureReason, 140))}</a> <span style="font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:#71717a;font-size:13px;">(${ctx.commitSha.slice(0, 12)})</span>`
					: `<code style="font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#f4f4f5;border:1px solid #e4e4e7;color:#18181b;padding:2px 6px;border-radius:4px;font-size:13px;">${ctx.commitSha.slice(0, 12)}</code>`
			}</li>`
		: "";
	const sourceItem = ctx.sourceRef
		? `<li style="margin-bottom:10px;color:#3f3f46;"><strong style="color:#18181b;">Source:</strong> <span style="color:#18181b;font-weight:500;">${escapeHtml(ctx.sourceRef)}</span></li>`
		: "";
	const reasonItem =
		ctx.failureReason && !ctx.commitSha
			? `<li style="margin-bottom:10px;color:#3f3f46;"><strong style="color:#18181b;">Reason:</strong> <span style="color:#dc2626;">${escapeHtml(truncated(ctx.failureReason, 160))}</span></li>`
			: "";

	const detailsItems = `${commitItem}${sourceItem}${reasonItem}`;
	const actionButton = ctx.logsUrl ? renderButton(ctx.logsUrl, "View Logs") : "";

	const body = deployFailureTpl
		.replace(/{{PROJECT_NAME}}/g, escapeHtml(ctx.projectName))
		.replace(/{{LOGS_URL}}/g, ctx.logsUrl || "#")
		.replace("{{DETAILS_ITEMS}}", detailsItems)
		.replace("{{ACTION_BUTTON}}", actionButton);

	return {
		subject: `deploy failed for ${ctx.projectName}`,
		html: renderShell("DEPLOY FAILED", THEME.redBg, THEME.red, body),
	};
};

export const buildSmtpTestEmail = (): { subject: string; html: string } => {
	return {
		subject: "[Dequel] SMTP Test Email",
		html: renderShell("SMTP TEST", THEME.greenBg, THEME.green, smtpTestTpl),
	};
};
