import { describe, expect, it } from "bun:test";
import { type Incident, DEFAULT_POLICY, backoffMs, commitAfterSend, decide } from "../incident-policy";

const P = DEFAULT_POLICY;
const MIN = 60_000;

const breach = (state: Incident | null, now: number) => decide(state, { kind: "breach" }, now, P);
const clear = (state: Incident | null, now: number) => decide(state, { kind: "clear" }, now, P);
const noData = (state: Incident | null, now: number) => decide(state, { kind: "no_data" }, now, P);

const firstSend = (now: number): Incident => {
	const d = breach(null, now);
	if (d.kind !== "send") throw new Error("expected send");
	return d.next;
};

describe("backoffMs", () => {
	it("grows tenfold per send and clamps at the cap", () => {
		expect(backoffMs(1, P)).toBe(5 * MIN);
		expect(backoffMs(2, P)).toBe(50 * MIN);
		expect(backoffMs(3, P)).toBe(500 * MIN);
		expect(backoffMs(4, P)).toBe(P.capMs);
		expect(backoffMs(5, P)).toBe(P.capMs);
		expect(backoffMs(99, P)).toBe(P.capMs);
	});
});

describe("decide — breach", () => {
	it("first breach sends immediately with the incident opened now", () => {
		const d = breach(null, 1_000);
		expect(d.kind).toBe("send");
		if (d.kind !== "send") return;
		expect(d.next).toEqual({
			status: "active",
			since: 1_000,
			sends: 1,
			nextDueAt: 1_000 + 5 * MIN,
			clearSince: null,
		});
	});

	it("does not send again before the backoff is due", () => {
		const state = firstSend(0);
		expect(breach(state, 4 * MIN + 59_000).kind).toBe("noop");
	});

	it("sends the next rung once due, stretching the gap tenfold", () => {
		const state = firstSend(0);
		const d = breach(state, 5 * MIN);
		expect(d.kind).toBe("send");
		if (d.kind !== "send") return;
		expect(d.next.sends).toBe(2);
		expect(d.next.nextDueAt).toBe(5 * MIN + 50 * MIN);
	});

	it("sends exactly 3 emails over an 8h sustained breach", () => {
		let state: Incident | null = null;
		let sends = 0;
		for (let minute = 0; minute <= 8 * 60; minute++) {
			const d = breach(state, minute * MIN);
			if (d.kind === "send") {
				sends++;
				state = d.next;
			} else if (d.kind === "commit") {
				state = d.next;
			}
		}
		expect(sends).toBe(3);
	});
});

describe("decide — no_data and clear", () => {
	it("no_data never fires and never mutates state", () => {
		const state = firstSend(0);
		expect(noData(state, 10 * MIN).kind).toBe("noop");
		expect(noData(null, 10 * MIN).kind).toBe("noop");
	});

	it("clear with no incident is a noop", () => {
		expect(clear(null, 0).kind).toBe("noop");
	});

	it("clear starts a recovery grace window without sending", () => {
		const state = firstSend(0);
		const d = clear(state, 2 * MIN);
		expect(d.kind).toBe("commit");
		if (d.kind !== "commit" || !d.next) return;
		expect(d.next.clearSince).toBe(2 * MIN);
		expect(d.next.sends).toBe(1);
	});

	it("clear inside the grace keeps the incident, past the grace deletes it", () => {
		const state = { ...firstSend(0), clearSince: 1 * MIN } as Incident;
		const inside = clear(state, 1 * MIN + P.recoveryGraceMs - 1_000);
		expect(inside.kind).toBe("noop");
		const past = clear(state, 1 * MIN + P.recoveryGraceMs);
		expect(past.kind).toBe("commit");
		if (past.kind !== "commit") return;
		expect(past.next).toBeNull();
	});

	it("a re-breach inside the grace cancels recovery and keeps the schedule", () => {
		const state = { ...firstSend(0), clearSince: 2 * MIN } as Incident;
		const d = breach(state, 3 * MIN);
		expect(d.kind).toBe("commit");
		if (d.kind !== "commit" || !d.next) return;
		expect(d.next.clearSince).toBeNull();
		expect(d.next.sends).toBe(1);
		expect(d.next.since).toBe(0);
	});

	it("a sustained clear then fresh breach restarts at send #1", () => {
		const state = firstSend(0);
		const started = clear(state, 6 * MIN);
		if (started.kind !== "commit" || !started.next) throw new Error("expected grace start");
		const recovered = clear(started.next, 6 * MIN + P.recoveryGraceMs);
		if (recovered.kind !== "commit" || recovered.next !== null) throw new Error("expected recovery");
		const fresh = breach(null, 10 * MIN);
		expect(fresh.kind).toBe("send");
		if (fresh.kind !== "send") return;
		expect(fresh.next.sends).toBe(1);
		expect(fresh.next.since).toBe(10 * MIN);
	});
});

describe("commitAfterSend", () => {
	const decision = () => {
		const d = breach(null, 0);
		if (d.kind !== "send") throw new Error("expected send");
		return d;
	};

	it("persists the new incident only on a confirmed send", () => {
		expect(commitAfterSend(null, decision(), { status: "sent" })).toEqual(decision().next);
	});

	it("keeps the prior state when the send failed or was skipped", () => {
		const prior = firstSend(0);
		expect(commitAfterSend(prior, decision(), { status: "failed", error: "x" })).toBe(prior);
		expect(commitAfterSend(prior, decision(), { status: "skipped", reason: "no_recipient" })).toBe(prior);
		expect(commitAfterSend(null, decision(), { status: "failed", error: "x" })).toBeNull();
	});
});
