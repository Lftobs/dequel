import { describe, expect, it } from "bun:test";
import type { Incident } from "../incident-policy";
import { createIncidentTracker, type IncidentStore } from "../incident-tracker";

const MIN = 60_000;

const makeStore = () => {
	const data = new Map<string, Incident>();
	let loadError = false;
	const store: IncidentStore = {
		async load(id) {
			if (loadError) throw new Error("redis down");
			return data.get(id) ?? null;
		},
		async save(id, state) {
			if (state) data.set(id, state);
			else data.delete(id);
		},
	};
	return { store, data, failLoad: () => (loadError = true) };
};

const makeSend = () => {
	const calls = { count: 0 };
	let failuresLeft = 0;
	const send = async () => {
		calls.count++;
		if (failuresLeft > 0) {
			failuresLeft--;
			return { status: "failed", error: "smtp down" } as const;
		}
		return { status: "sent" } as const;
	};
	return { calls, send, failNext: () => (failuresLeft = 1) };
};

describe("incident tracker", () => {
	it("sends the first breach and stores the incident", async () => {
		const { store, data } = makeStore();
		const { calls, send } = makeSend();
		const tracker = createIncidentTracker(store);

		await tracker.step({ alertId: "a1", observation: { kind: "breach" }, now: 0, send });

		expect(calls.count).toBe(1);
		expect(data.get("a1")?.sends).toBe(1);
	});

	it("suppresses repeat sends until the backoff is due", async () => {
		const { store, data } = makeStore();
		const { calls, send } = makeSend();
		const tracker = createIncidentTracker(store);

		await tracker.step({ alertId: "a1", observation: { kind: "breach" }, now: 0, send });
		await tracker.step({ alertId: "a1", observation: { kind: "breach" }, now: 4 * MIN, send });
		expect(calls.count).toBe(1);

		await tracker.step({ alertId: "a1", observation: { kind: "breach" }, now: 5 * MIN, send });
		expect(calls.count).toBe(2);
		expect(data.get("a1")?.sends).toBe(2);
	});

	it("keeps the prior state when the send fails, then retries next tick", async () => {
		const { store, data } = makeStore();
		const { calls, send, failNext } = makeSend();
		const tracker = createIncidentTracker(store);

		failNext();
		await tracker.step({ alertId: "a1", observation: { kind: "breach" }, now: 0, send });
		expect(calls.count).toBe(1);
		expect(data.has("a1")).toBe(false);

		await tracker.step({ alertId: "a1", observation: { kind: "breach" }, now: MIN, send });
		expect(calls.count).toBe(2);
		expect(data.get("a1")?.sends).toBe(1);
	});

	it("deletes the incident after a sustained clear", async () => {
		const { store, data } = makeStore();
		const { send } = makeSend();
		const tracker = createIncidentTracker(store);

		await tracker.step({ alertId: "a1", observation: { kind: "breach" }, now: 0, send });
		await tracker.step({ alertId: "a1", observation: { kind: "clear" }, now: 2 * MIN, send });
		expect(data.get("a1")?.clearSince).toBe(2 * MIN);

		await tracker.step({ alertId: "a1", observation: { kind: "clear" }, now: 8 * MIN, send });
		expect(data.has("a1")).toBe(false);
	});

	it("refreshes the stored incident on a suppressed tick", async () => {
		const { store, data } = makeStore();
		const { calls, send } = makeSend();
		const tracker = createIncidentTracker(store);

		await tracker.step({ alertId: "a1", observation: { kind: "breach" }, now: 0, send });
		const stored = data.get("a1");
		await tracker.step({ alertId: "a1", observation: { kind: "breach" }, now: MIN, send });
		expect(calls.count).toBe(1);
		expect(data.get("a1")).toEqual(stored);
	});

	it("aborts before sending when the store is unavailable", async () => {
		const { store, failLoad } = makeStore();
		const { calls, send } = makeSend();
		const tracker = createIncidentTracker(store);

		failLoad();
		await expect(tracker.step({ alertId: "a1", observation: { kind: "breach" }, now: 0, send })).rejects.toThrow(
			"redis down",
		);
		expect(calls.count).toBe(0);
	});
});
