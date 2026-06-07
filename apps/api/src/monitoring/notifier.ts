import nodemailer from 'nodemailer';
import { config } from '../utils/config';

type NotifyOpts = {
  channel: string;
  destination: string | null;
  projectName: string;
  alertType: string;
  threshold: number | null;
  currentValue: number;
};

let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!config.smtpHost) return null;
  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: config.smtpUser && config.smtpPass ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
  });
  return transporter;
};

const subject = (projectName: string, alertType: string) =>
  `[Dequel] ${alertType.toUpperCase()} alert — ${projectName}`;

const textBody = (projectName: string, alertType: string, threshold: number | null, currentValue: number) =>
  `Alert: ${projectName}\n\nType: ${alertType}\nThreshold: ${threshold ?? 'N/A'}\nCurrent value: ${currentValue}\n\nThis is an automated notification from Dequel.`;

const sendEmail = async (to: string, projectName: string, alertType: string, threshold: number | null, currentValue: number) => {
  const t = getTransporter();
  if (!t) {
    console.warn(`[Notifier] SMTP not configured — skipping email to ${to}`);
    return;
  }
  await t.sendMail({
    from: config.smtpFrom,
    to,
    subject: subject(projectName, alertType),
    text: textBody(projectName, alertType, threshold, currentValue),
  });
};

const sendSlack = async (webhookUrl: string, projectName: string, alertType: string, threshold: number | null, currentValue: number) => {
  const payload = {
    text: subject(projectName, alertType),
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `⚠️ Dequel Alert: ${projectName}` } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Type:* ${alertType}` },
        { type: 'mrkdwn', text: `*Threshold:* ${threshold ?? 'N/A'}` },
        { type: 'mrkdwn', text: `*Current:* ${currentValue}` },
      ]},
    ],
  };
  const res = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) console.warn(`[Notifier] Slack webhook returned ${res.status}`);
};

const sendWebhook = async (url: string, projectName: string, alertType: string, threshold: number | null, currentValue: number) => {
  const payload = { event: 'alert', project: projectName, type: alertType, threshold, currentValue, timestamp: new Date().toISOString() };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) console.warn(`[Notifier] Webhook returned ${res.status}`);
};

export const sendNotification = async (opts: NotifyOpts): Promise<void> => {
  const { channel, destination, projectName, alertType, threshold, currentValue } = opts;
  if (!destination) {
    console.warn(`[Notifier] No destination for ${channel} alert — skipping`);
    return;
  }
  const fn = channel === 'email' ? sendEmail
    : channel === 'slack' ? sendSlack
    : channel === 'webhook' ? sendWebhook
    : null;
  if (!fn) {
    console.warn(`[Notifier] Unknown channel: ${channel}`);
    return;
  }
  try {
    await fn(destination, projectName, alertType, threshold, currentValue);
    console.log(`[Notifier] ${channel} alert sent to ${destination}`);
  } catch (err) {
    console.error(`[Notifier] Failed to send ${channel} alert:`, err);
  }
};
