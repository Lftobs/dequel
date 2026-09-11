import { logBus } from "../orchestrator/log-bus";

let appendLogModule: typeof import("../db/repo") | null = null;

export const emitLog = async (deploymentId: string, stage: "build" | "deploy" | "system", message: string) => {
	const timestamp = new Date()
		.toISOString()
		.replace("T", " ")
		.replace(/\.\d{3}Z$/, "");
	appendLogModule ??= await import("../db/repo");
	const saved = await appendLogModule.appendLog(deploymentId, stage, message);
	logBus.publish({
		deploymentId,
		sequence: saved.sequence,
		stage,
		message,
		timestamp,
	});
};
