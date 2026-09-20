import { describe, expect, it } from "bun:test";
import { parseP2PAgentRequest } from "../protocol";

const capabilities = {
	docker: true,
	buildkit: true,
	caddy: true,
	compose: true,
	architectures: ["x64"],
	cpuCount: 4,
	memoryBytes: 1024,
	diskBytes: 2048,
};

describe("agent P2P protocol", () => {
	it("accepts a valid heartbeat request", () => {
		expect(
			parseP2PAgentRequest(
				JSON.stringify({
					type: "p2p_heartbeat",
					protocolVersion: 1,
					credential: "dqa_test",
					agentVersion: "0.2.1",
					capabilities,
					resources: { cpuUsedPercent: 12, memoryUsedMb: 512 },
					containers: [{ containerName: "app-abc", cpuPercent: 4, memoryMb: 64 }],
				}),
			),
		).toEqual({
			type: "p2p_heartbeat",
			protocolVersion: 1,
			credential: "dqa_test",
			agentVersion: "0.2.1",
			capabilities,
			resources: { cpuUsedPercent: 12, memoryUsedMb: 512 },
			containers: [{ containerName: "app-abc", cpuPercent: 4, memoryMb: 64 }],
		});
	});

	it("rejects unsupported protocol versions", () => {
		expect(
			parseP2PAgentRequest({
				type: "p2p_heartbeat",
				protocolVersion: 2,
				credential: "dqa_test",
				agentVersion: "0.2.1",
				capabilities,
			}),
		).toBeNull();
	});

	it("rejects requests without a credential", () => {
		expect(
			parseP2PAgentRequest({ type: "job_ack", protocolVersion: 1, jobId: "job-1", leaseId: "lease-1" }),
		).toBeNull();
	});

	it("requires lease IDs on job lifecycle messages", () => {
		expect(
			parseP2PAgentRequest({ type: "job_ack", protocolVersion: 1, credential: "dqa_test", jobId: "job-1" }),
		).toBeNull();
		expect(
			parseP2PAgentRequest({
				type: "job_ack",
				protocolVersion: 1,
				credential: "dqa_test",
				jobId: "job-1",
				leaseId: "lease-1",
			}),
		).not.toBeNull();
	});

	it("rejects malformed capabilities", () => {
		expect(
			parseP2PAgentRequest({
				type: "p2p_heartbeat",
				protocolVersion: 1,
				credential: "dqa_test",
				agentVersion: "0.2.1",
				capabilities: { ...capabilities, cpuCount: "four" },
			}),
		).toBeNull();
	});
});
