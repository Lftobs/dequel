import type { AlertDetails } from "./templates";

const formatValue = (alertType: string, value: number): string => {
	if (alertType === "downtime") return "Service down";
	if (alertType === "memory") return `${value.toFixed(0)} MB`;
	return `${value.toFixed(1)}%`;
};

const formatThreshold = (alertType: string, threshold: number | null): string => {
	if (alertType === "downtime" || threshold === null) return "N/A";
	return alertType === "memory" ? String(threshold) : `${threshold}%`;
};

const formatContainer = (alertType: string, c: { name: string; value: number }): string =>
	`\`${c.name}\` ${alertType === "memory" ? `${c.value.toFixed(0)} MB` : `${c.value.toFixed(1)}%`}`;

type SlackBlock =
	| { type: "header"; text: { type: string; text: string } }
	| {
			type: "section";
			text?: { type: string; text: string };
			fields?: { type: string; text: string }[];
	  }
	| { type: "actions"; elements: { type: string; text: { type: string; text: string }; url: string }[] };

export const buildSlackMessage = (
	alertType: string,
	projectName: string,
	threshold: number | null,
	currentValue: number,
	details?: AlertDetails,
): { text: string; blocks: SlackBlock[] } => {
	const blocks: SlackBlock[] = [
		{ type: "header", text: { type: "plain_text", text: `Dequel alert: ${projectName}` } },
		{
			type: "section",
			fields: [
				{ type: "mrkdwn", text: `*Type:* ${alertType.replace("_", " ")}` },
				{ type: "mrkdwn", text: `*Threshold:* ${formatThreshold(alertType, threshold)}` },
				{ type: "mrkdwn", text: `*Current:* ${formatValue(alertType, currentValue)}` },
			],
		},
	];
	const containers = details?.containers ?? [];
	if (containers.length > 0) {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: containers.map((c) => `• ${formatContainer(alertType, c)}`).join("\n"),
			},
		});
	}
	if (details?.scaling) {
		const s = details.scaling;
		const title = s.kind === "enable_autoscaling" ? "Autoscaling is off" : "Replica limit reached";
		const body =
			s.kind === "enable_autoscaling"
				? "Enable autoscaling so Dequel adds capacity automatically while load stays high."
				: `At the replica limit (${s.current}/${s.maxReplicas}) — raise max replicas so autoscaling can add capacity.`;
		const cta = s.kind === "enable_autoscaling" ? "Set up autoscaling" : "Adjust scaling";
		blocks.push({ type: "section", text: { type: "mrkdwn", text: `*${title}*\n${body}` } });
		blocks.push({
			type: "actions",
			elements: [{ type: "button", text: { type: "plain_text", text: cta }, url: s.url }],
		});
	}
	if (details?.projectUrl) {
		blocks.push({
			type: "actions",
			elements: [{ type: "button", text: { type: "plain_text", text: "Open project" }, url: details.projectUrl }],
		});
	}
	return { text: `${projectName}: ${alertType} alert`, blocks };
};
