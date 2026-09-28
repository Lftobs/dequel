import { describe, expect, it } from "bun:test";
import { scalingGuard } from "../alert-guard";

const enabled = (maxReplicas = 5) => ({ enabled: true, maxReplicas });

describe("scalingGuard", () => {
	it("does not touch downtime or unknown alert types", () => {
		expect(scalingGuard("downtime", { policy: null, cpuLimit: null, currentReplicas: null })).toEqual({
			suppress: false,
			suggestion: null,
		});
	});

	it("fires with an enable prompt when no policy exists", () => {
		expect(scalingGuard("cpu", { policy: null, cpuLimit: 1, currentReplicas: 1 })).toEqual({
			suppress: false,
			suggestion: { kind: "enable_autoscaling" },
		});
	});

	it("fires with an enable prompt when the policy is disabled", () => {
		expect(
			scalingGuard("memory", {
				policy: { enabled: false, maxReplicas: 5 },
				cpuLimit: 1,
				currentReplicas: 1,
			}),
		).toEqual({ suppress: false, suggestion: { kind: "enable_autoscaling" } });
	});

	it("fires with an enable prompt when no cpu limit is set", () => {
		expect(scalingGuard("cpu", { policy: enabled(), cpuLimit: null, currentReplicas: 1 })).toEqual({
			suppress: false,
			suggestion: { kind: "enable_autoscaling" },
		});
		expect(scalingGuard("cpu", { policy: enabled(), cpuLimit: 0, currentReplicas: 1 })).toEqual({
			suppress: false,
			suggestion: { kind: "enable_autoscaling" },
		});
	});

	it("fires with an increase-replicas prompt when at the ceiling", () => {
		expect(scalingGuard("cpu", { policy: enabled(3), cpuLimit: 1, currentReplicas: 3 })).toEqual({
			suppress: false,
			suggestion: { kind: "increase_max_replicas", current: 3, maxReplicas: 3 },
		});
	});

	it("treats an unknown replica count as a single replica", () => {
		expect(scalingGuard("cpu", { policy: enabled(1), cpuLimit: 1, currentReplicas: null })).toEqual({
			suppress: false,
			suggestion: { kind: "increase_max_replicas", current: 1, maxReplicas: 1 },
		});
		expect(scalingGuard("cpu", { policy: enabled(5), cpuLimit: 1, currentReplicas: null })).toEqual({
			suppress: true,
			suggestion: null,
		});
	});

	it("suppresses when autoscaling is on and replicas are below the ceiling", () => {
		expect(scalingGuard("cpu", { policy: enabled(5), cpuLimit: 1, currentReplicas: 1 })).toEqual({
			suppress: true,
			suggestion: null,
		});
		expect(scalingGuard("memory", { policy: enabled(5), cpuLimit: 1, currentReplicas: 4 })).toEqual({
			suppress: true,
			suggestion: null,
		});
	});
});
