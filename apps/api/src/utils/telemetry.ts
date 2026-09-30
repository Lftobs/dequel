import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import packageJson from "../../package.json";
import { config } from "./config";

const getPosthogKey = () => config.posthogKey || process.env.DEQUEL_POSTHOG_KEY || "phc_dequel_telemetry_public_key";
const getPosthogHost = () => config.telemetryHost || process.env.DEQUEL_TELEMETRY_HOST || "https://us.i.posthog.com";

const getTelemetryFilePath = () => {
	const dataDir = join(config.workspaceRoot, "..", "data");
	return join(dataDir, ".instance-id");
};

export const getInstanceId = (): string => {
	try {
		const filePath = getTelemetryFilePath();
		if (existsSync(filePath)) {
			const id = readFileSync(filePath, "utf-8").trim();
			if (id) return id;
		}
		const newId = randomUUID();
		mkdirSync(dirname(filePath), { recursive: true });
		writeFileSync(filePath, newId, "utf-8");
		return newId;
	} catch {
		return "anonymous-instance";
	}
};

export const captureTelemetry = async (event: string, properties: Record<string, unknown> = {}): Promise<void> => {
	if (process.env.DEQUEL_TELEMETRY_DISABLED === "1" || process.env.DO_NOT_TRACK === "1") {
		return;
	}

	try {
		const instanceId = getInstanceId();
		const key = getPosthogKey();
		const host = getPosthogHost();
		const payload = {
			api_key: key,
			event,
			distinct_id: instanceId,
			properties: {
				...properties,
				instance_id: instanceId,
				version: packageJson.version,
				platform: process.platform,
				arch: process.arch,
				bun_version: Bun.version,
			},
		};

		await fetch(`${host.replace(/\/$/, "")}/capture/`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		}).catch(() => {});
	} catch {
		// Silent catch — telemetry should never affect platform execution
	}
};
