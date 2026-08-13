import { describe, expect, it } from "bun:test";
import { parseP2PResponse, serializeAgentMessage } from "./protocol";

describe("agent P2P protocol", () => {
  it("parses a valid p2p response with jobs", () => {
    const response = {
      ok: true,
      serverId: "server-1",
      heartbeatIntervalMs: 15_000,
      jobs: [{ id: "job-1", deploymentId: "dep-1", type: "deploy", payload: {}, leaseId: "lease-1", leaseExpiresAt: "2026-01-01T00:00:00Z", idempotencyKey: "deployment:dep-1" }],
      cancelJobIds: [],
    };
    expect(parseP2PResponse(JSON.stringify(response))).toEqual(response);
  });

  it("rejects malformed responses", () => {
    expect(parseP2PResponse({ ok: false })).toBeNull();
    expect(parseP2PResponse({ ok: true, serverId: "s", heartbeatIntervalMs: 1000, jobs: {}, cancelJobIds: [] })).toBeNull();
    expect(parseP2PResponse("not json")).toBeNull();
  });

  it("serializes heartbeat messages", () => {
    const raw = serializeAgentMessage({ type: "p2p_heartbeat", protocolVersion: 1, credential: "dqa_test", agentVersion: "0.2.1", capabilities: { docker: true, buildkit: true, caddy: true, compose: true, architectures: [], cpuCount: 2, memoryBytes: 1024, diskBytes: 1024 } });
    expect(JSON.parse(raw).type).toBe("p2p_heartbeat");
  });
});