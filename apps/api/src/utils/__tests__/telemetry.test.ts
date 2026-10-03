import { describe, expect, it, spyOn } from "bun:test";
import { captureTelemetry, getInstanceId } from "../telemetry";

describe("Telemetry Utility", () => {
	it("generates and persists an instance ID", () => {
		const instanceId = getInstanceId();
		expect(typeof instanceId).toBe("string");
		expect(instanceId.length).toBeGreaterThan(0);
		expect(getInstanceId()).toBe(instanceId);
	});

	it("respects DEQUEL_TELEMETRY_DISABLED=1", async () => {
		process.env.DEQUEL_TELEMETRY_DISABLED = "1";
		const fetchSpy = spyOn(globalThis, "fetch");

		await captureTelemetry("test_event", { foo: "bar" });
		expect(fetchSpy).not.toHaveBeenCalled();

		delete process.env.DEQUEL_TELEMETRY_DISABLED;
		fetchSpy.mockRestore();
	});
});
