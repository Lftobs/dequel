import nodemailer from "nodemailer";
import { getSmtpSettings } from "../db/repo/settings";
import type { FailureNotificationContext, MailDelivery } from "../types";
import { appBaseUrl } from "../utils/routes";
import { validateDestination } from "../utils/destination";
import { buildSlackMessage } from "./slack-message";
import { type AlertDetails, buildDeploymentFailureEmail, buildEmail } from "./templates";

type NotifyOpts = {
	channel: string;
	destination: string | null;
	projectName: string;
	alertType: string;
	threshold: number | null;
	currentValue: number;
	details?: AlertDetails;
};

type SmtpConfig = {
	host: string;
	port: number;
	user: string;
	pass: string;
	from: string;
};

const loadSmtpConfig = async (): Promise<SmtpConfig | null> => {
	try {
		const db = await getSmtpSettings();
		if (db?.host) {
			return { host: db.host, port: db.port, user: db.user, pass: db.pass, from: db.fromAddress };
		}
	} catch {}
	return null;
};

let transporter: nodemailer.Transporter | null = null;
let transporterKey = "";

const getTransporter = async (smtp: SmtpConfig) => {
	const key = `${smtp.host}:${smtp.port}:${smtp.user}:${smtp.pass}`;
	if (transporter && transporterKey === key) return transporter;
	transporter = nodemailer.createTransport({
		host: smtp.host,
		port: smtp.port,
		secure: smtp.port === 465,
		auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
		connectionTimeout: 10_000,
		greetingTimeout: 10_000,
		socketTimeout: 30_000,
	});
	transporterKey = key;
	return transporter;
};

const sendEmail = async (
	to: string,
	projectName: string,
	alertType: string,
	threshold: number | null,
	currentValue: number,
	details?: AlertDetails,
) => {
	const smtp = await loadSmtpConfig();
	if (!smtp) {
		console.warn(`[Notifier] SMTP not configured — skipping email to ${to}`);
		return;
	}
	const { subject, html } = buildEmail(alertType, projectName, threshold, currentValue, details);
	const t = await getTransporter(smtp);
	await t.sendMail({
		from: smtp.from,
		to,
		subject,
		html,
	});
};

const sendSlack = async (
	webhookUrl: string,
	projectName: string,
	alertType: string,
	threshold: number | null,
	currentValue: number,
	details?: AlertDetails,
) => {
	const payload = buildSlackMessage(alertType, projectName, threshold, currentValue, details);
	const res = await fetch(webhookUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
		redirect: "manual",
		signal: AbortSignal.timeout(10_000),
	});
	if (!res.ok) throw new Error(`Slack webhook returned ${res.status}`);
};

const sendWebhook = async (
	url: string,
	projectName: string,
	alertType: string,
	threshold: number | null,
	currentValue: number,
) => {
	const payload = {
		event: "alert",
		project: projectName,
		type: alertType,
		threshold,
		currentValue,
		timestamp: new Date().toISOString(),
	};
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
		redirect: "manual",
		signal: AbortSignal.timeout(10_000),
	});
	if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
};

export const sendNotification = async (opts: NotifyOpts): Promise<MailDelivery> => {
	const { channel, projectName, alertType, threshold, currentValue, details } = opts;
	let destination = opts.destination;
	if (!destination && channel === "email") {
		const smtp = await loadSmtpConfig();
		destination = smtp?.from ?? null;
	}
	if (!destination) {
		console.warn(`[Notifier] No destination for ${channel} alert — skipping`);
		return { status: "skipped", reason: "no_recipient" };
	}
	try {
		if (channel === "slack" || channel === "webhook") {
			const destinationError = await validateDestination(destination);
			if (destinationError) throw new Error(destinationError);
		}
		if (channel === "email") {
			await sendEmail(destination, projectName, alertType, threshold, currentValue, details);
		} else if (channel === "slack") {
			await sendSlack(destination, projectName, alertType, threshold, currentValue, details);
		} else if (channel === "webhook") {
			await sendWebhook(destination, projectName, alertType, threshold, currentValue);
		} else {
			console.warn(`[Notifier] Unknown channel: ${channel}`);
			return { status: "failed", error: `unknown channel: ${channel}` };
		}
		console.log(`[Notifier] ${channel} alert sent to ${destination}`);
		return { status: "sent" };
	} catch (err) {
		console.error(`[Notifier] Failed to send ${channel} alert:`, err);
		return { status: "failed", error: err instanceof Error ? err.message : String(err) };
	}
};

export const isSmtpConfigured = async (): Promise<boolean> => (await loadSmtpConfig()) !== null;

export const sendDeploymentFailureEmail = async (ctx: FailureNotificationContext): Promise<MailDelivery> => {
	const smtp = await loadSmtpConfig();
	if (!smtp) return { status: "skipped", reason: "no_smtp" };
	const to = smtp.from;
	if (!to) return { status: "skipped", reason: "no_recipient" };
	try {
		const logsUrl = ctx.projectId ? `${appBaseUrl()}/project/${ctx.projectId}?tab=deployments` : undefined;
		const { subject, html } = buildDeploymentFailureEmail({ ...ctx, logsUrl });
		const t = await getTransporter(smtp);
		await t.sendMail({ from: smtp.from, to, subject, html });
		return { status: "sent" };
	} catch (err) {
		return { status: "failed", error: err instanceof Error ? err.message : String(err) };
	}
};
