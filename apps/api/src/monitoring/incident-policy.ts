import type { MailDelivery } from "../types";

export type Observation = { kind: "breach" } | { kind: "clear" } | { kind: "no_data" };

export type Incident = {
	status: "active";
	since: number;
	sends: number;
	nextDueAt: number;
	clearSince: number | null;
};

export type IncidentPolicy = {
	baseMs: number;
	factor: number;
	capMs: number;
	recoveryGraceMs: number;
};

export type Decision = { kind: "noop" } | { kind: "commit"; next: Incident | null } | { kind: "send"; next: Incident };

export const DEFAULT_POLICY: IncidentPolicy = {
	baseMs: 300_000,
	factor: 10,
	capMs: 43_200_000,
	recoveryGraceMs: 300_000,
};

export const backoffMs = (sends: number, p: IncidentPolicy): number => {
	const exponent = Math.max(0, sends - 1);
	if (exponent > 30) return p.capMs;
	return Math.min(p.baseMs * p.factor ** exponent, p.capMs);
};

export const decide = (state: Incident | null, obs: Observation, now: number, p: IncidentPolicy): Decision => {
	if (obs.kind === "no_data") return { kind: "noop" };

	if (obs.kind === "clear") {
		if (!state) return { kind: "noop" };
		if (state.clearSince === null) return { kind: "commit", next: { ...state, clearSince: now } };
		if (now - state.clearSince >= p.recoveryGraceMs) return { kind: "commit", next: null };
		return { kind: "noop" };
	}

	if (!state) {
		return {
			kind: "send",
			next: {
				status: "active",
				since: now,
				sends: 1,
				nextDueAt: now + backoffMs(1, p),
				clearSince: null,
			},
		};
	}

	const reentered = state.clearSince !== null ? { ...state, clearSince: null } : state;
	if (now >= reentered.nextDueAt) {
		const sends = reentered.sends + 1;
		return {
			kind: "send",
			next: { ...reentered, sends, nextDueAt: now + backoffMs(sends, p) },
		};
	}
	if (reentered !== state) return { kind: "commit", next: reentered };
	return { kind: "noop" };
};

export const commitAfterSend = (
	prior: Incident | null,
	decision: Extract<Decision, { kind: "send" }>,
	delivery: MailDelivery,
): Incident | null => (delivery.status === "sent" ? decision.next : prior);
