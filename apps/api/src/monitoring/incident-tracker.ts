import type { Redis } from "ioredis";
import type { MailDelivery } from "../types";
import {
	type Decision,
	type Incident,
	type IncidentPolicy,
	type Observation,
	DEFAULT_POLICY,
	commitAfterSend,
	decide,
} from "./incident-policy";

const KEY_PREFIX = "dequel:alert:incident:";
const TTL_SECONDS = 604_800;

export type StepInput = {
	alertId: string;
	observation: Observation;
	now?: number;
	send: () => Promise<MailDelivery>;
};

export type IncidentStore = {
	load(alertId: string): Promise<Incident | null>;
	save(alertId: string, state: Incident | null): Promise<void>;
};

export type IncidentTracker = { step(input: StepInput): Promise<void> };

const isIncident = (value: unknown): value is Incident => {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return (
		v.status === "active" &&
		typeof v.since === "number" &&
		typeof v.sends === "number" &&
		typeof v.nextDueAt === "number" &&
		(v.clearSince === null || typeof v.clearSince === "number")
	);
};

export const createRedisIncidentStore = (redis: Redis): IncidentStore => ({
	async load(alertId) {
		const raw = await redis.get(KEY_PREFIX + alertId);
		if (!raw) return null;
		try {
			const parsed = JSON.parse(raw);
			return isIncident(parsed) ? parsed : null;
		} catch {
			return null;
		}
	},
	async save(alertId, state) {
		const key = KEY_PREFIX + alertId;
		if (!state) {
			await redis.del(key);
			return;
		}
		await redis.set(key, JSON.stringify(state), "EX", TTL_SECONDS);
	},
});

export const createIncidentTracker = (
	store: IncidentStore,
	policy: IncidentPolicy = DEFAULT_POLICY,
): IncidentTracker => ({
	async step(input) {
		const state = await store.load(input.alertId);
		const decision: Decision = decide(state, input.observation, input.now ?? Date.now(), policy);

		if (decision.kind === "send") {
			const delivery = await input.send();
			await store.save(input.alertId, commitAfterSend(state, decision, delivery));
			return;
		}
		if (decision.kind === "commit") {
			await store.save(input.alertId, decision.next);
			return;
		}
		if (state) await store.save(input.alertId, state);
	},
});
