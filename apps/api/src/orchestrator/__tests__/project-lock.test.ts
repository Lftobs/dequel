import { describe, expect, it } from "bun:test";
import { acquireProjectLock } from "../project-lock";

const withTimeout = <T>(promise: Promise<T>, ms = 500): Promise<T | "timeout"> =>
	Promise.race([promise, new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms))]);

describe("project lock", () => {
	it("serializes holders of the same key", async () => {
		const order: string[] = [];
		const releaseA = await acquireProjectLock("proj-serial");
		let bAcquired = false;
		const b = acquireProjectLock("proj-serial").then((release) => {
			bAcquired = true;
			order.push("b");
			release();
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(bAcquired).toBe(false);
		order.push("a");
		releaseA();
		await b;
		expect(order).toEqual(["a", "b"]);
	});

	it("does not block different keys", async () => {
		const releaseA = await acquireProjectLock("proj-other-1");
		const b = await withTimeout(
			acquireProjectLock("proj-other-2").then((release) => {
				release();
				return "acquired";
			}),
		);
		expect(b).toBe("acquired");
		releaseA();
	});

	it("allows reacquisition after release", async () => {
		const release = await acquireProjectLock("proj-reuse");
		release();
		const again = await withTimeout(
			acquireProjectLock("proj-reuse").then((next) => {
				next();
				return "acquired";
			}),
		);
		expect(again).toBe("acquired");
	});

	it("tolerates double release", async () => {
		const release = await acquireProjectLock("proj-double");
		release();
		release();
		const after = await withTimeout(
			acquireProjectLock("proj-double").then((next) => {
				next();
				return "acquired";
			}),
		);
		expect(after).toBe("acquired");
	});

	it("keeps FIFO order for queued holders", async () => {
		const order: string[] = [];
		const release = await acquireProjectLock("proj-fifo");
		const make = (label: string) =>
			acquireProjectLock("proj-fifo").then((next) => {
				order.push(label);
				next();
			});
		const second = make("second");
		const third = make("third");
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(order).toEqual([]);
		release();
		await Promise.all([second, third]);
		expect(order).toEqual(["second", "third"]);
	});
});
