import { describe, expect, it } from "bun:test";
import { buildProjectPatch } from "../../api/projects/patch";
import { pickDefined } from "../repo/helpers";

describe("pickDefined", () => {
	it("copies only keys whose values are not undefined", () => {
		const patch = {
			name: "web",
			description: undefined,
			port: null,
			maintenanceEnabled: false,
			buildCommand: "",
			extra: "ignored",
		};
		const result = pickDefined(patch, ["name", "description", "port", "maintenanceEnabled", "buildCommand"]);
		expect(result).toEqual({
			name: "web",
			port: null,
			maintenanceEnabled: false,
			buildCommand: "",
		});
		expect("description" in result).toBe(false);
		expect("extra" in result).toBe(false);
	});
});

describe("buildProjectPatch", () => {
	it("normalizes nullable strings, numeric ports, and omitted fields", () => {
		const patch = buildProjectPatch(
			{
				name: "api",
				buildCommand: "",
				port: "3000",
				composePort: 0,
				restartMaxRetries: "5",
				stopGracePeriodSeconds: null,
				composeServices: { web: { port: 80 } },
			},
			{ tags: ["backend"] },
		);
		expect(patch.name).toBe("api");
		expect(patch.buildCommand).toBeNull();
		expect(patch.port).toBe(3000);
		expect(patch.composePort).toBeNull();
		expect(patch.restartMaxRetries).toBe(5);
		expect(patch.stopGracePeriodSeconds).toBeNull();
		expect(patch.composeServices).toBe('{"web":{"port":80}}');
		expect(patch.tags).toEqual(["backend"]);
		expect(patch.installCommand).toBeUndefined();
	});
});
