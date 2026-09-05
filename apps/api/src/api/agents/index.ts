import { Elysia } from "elysia";
import {
	HEARTBEAT_INTERVAL_MS,
	handleP2PHeartbeat,
	nextJobBatch,
	processAgentJobUpdate,
} from "../../agents/job-channel";
import type { AgentCapabilities } from "../../agents/protocol";
import { parseP2PAgentRequest } from "../../agents/protocol";
import { createAgentRegistrationToken, exchangeAgentRegistrationToken, validateAgentCredential } from "../../db/repo";
import { created, fail, ok } from "../response";

const isLabels = (value: unknown): value is Record<string, string> =>
	value === undefined ||
	(typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		Object.values(value).every((item) => typeof item === "string"));

const isCapabilities = (value: unknown): value is AgentCapabilities => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const item = value as Record<string, unknown>;
	return (
		["docker", "buildkit", "caddy", "compose"].every((key) => typeof item[key] === "boolean") &&
		Array.isArray(item.architectures) &&
		item.architectures.every((arch) => typeof arch === "string") &&
		["cpuCount", "memoryBytes", "diskBytes"].every((key) => typeof item[key] === "number")
	);
};

export const agentRoutes = new Elysia()
	.post("/agents/registration-tokens", async ({ body, set }: any) => {
		if (
			!body?.name ||
			typeof body.name !== "string" ||
			!body.name.trim() ||
			body.name.trim().length > 100 ||
			!isLabels(body.labels)
		) {
			set.status = 400;
			return fail("name and string labels are required");
		}
		return created(await createAgentRegistrationToken(body.name.trim(), body.labels || {}));
	})
	.post("/agents/register", async ({ body, set }: any) => {
		if (
			!body?.token ||
			typeof body.token !== "string" ||
			typeof body.agentVersion !== "string" ||
			!isCapabilities(body.capabilities)
		) {
			set.status = 400;
			return fail("token, agentVersion, and valid capabilities are required");
		}
		if (
			body.publicHost !== undefined &&
			(typeof body.publicHost !== "string" || !/^[a-zA-Z0-9.-]+$/.test(body.publicHost))
		) {
			set.status = 400;
			return fail("publicHost must be a hostname or IP address");
		}
		const result = await exchangeAgentRegistrationToken(
			body.token,
			body.agentVersion,
			body.capabilities,
			body.publicHost,
		);
		if (!result) {
			set.status = 401;
			return fail("Registration token is invalid, expired, or already used");
		}
		return ok(result, "Agent registered");
	})
	.post("/agents/p2p-sync", async ({ body, set }: any) => {
		const request = parseP2PAgentRequest(body);
		if (!request) {
			set.status = 400;
			return fail("Invalid or unsupported P2P request");
		}
		const serverId = await validateAgentCredential(request.credential);
		if (!serverId) {
			set.status = 401;
			return fail("Agent credential is invalid or revoked");
		}
		if (request.type === "p2p_heartbeat") {
			await handleP2PHeartbeat(serverId, {
				agentVersion: request.agentVersion,
				capabilities: request.capabilities,
				cpuUsedPercent: request.resources?.cpuUsedPercent,
				memoryUsedMb: request.resources?.memoryUsedMb,
				containers: request.containers,
			});
		} else {
			await processAgentJobUpdate(serverId, request);
		}
		const batch = await nextJobBatch(serverId);
		return ok({
			serverId,
			heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
			jobs: batch.jobs,
			cancelJobIds: batch.cancelJobIds,
		});
	});
