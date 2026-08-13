import { describe, expect, it } from "bun:test";
import { buildRemoteDeployScript, parseRemoteBuildResult } from "../ssh-build-script";
import { executorFor } from "../dispatch";

const input = {
  deploymentId: "deployment-1",
  workspaceRoot: "/var/lib/dequel/workspace",
  gitUrl: "https://github.com/example/api.git",
  branch: "main",
  commitSha: null,
  imageTag: "example-api-deploym:latest",
  clearCache: false,
  environmentVariables: [{ key: "NODE_ENV", value: "production" }],
};

describe("remote SSH build script", () => {
  it("embeds inputs with single-quote escaping", () => {
    const script = buildRemoteDeployScript(input);
    expect(script).toContain("set -euo pipefail");
    expect(script).toContain("git clone --depth 1 'https://github.com/example/api.git' .");
    expect(script).toContain("--env 'NODE_ENV=production'");
    expect(script).toContain("--name 'example-api-deploym:latest'");
    expect(script).toContain('echo "RESULT:{\\"imageTag\\":\\"example-api-deploym:latest\\",\\"commitSha\\":\\"$SHA\\"}"');
  });

  it("escapes single quotes in values", () => {
    const script = buildRemoteDeployScript({
      ...input,
      environmentVariables: [{ key: "GREETING", value: "it's fine" }],
    });
    expect(script).toContain("--env 'GREETING=it'\\''s fine'");
  });

  it("checks out a specific commit when provided", () => {
    const script = buildRemoteDeployScript({ ...input, commitSha: "abc1234", branch: null });
    expect(script).toContain("git fetch --depth 1 origin 'abc1234' && git checkout 'abc1234'");
  });

  it("uses a fresh cache key for clear builds", () => {
    const script = buildRemoteDeployScript({ ...input, clearCache: true });
    expect(script).toContain("--cache-key 'example-api-deploym-clear-");
  });

  it("installs railpack when missing", () => {
    const script = buildRemoteDeployScript(input);
    expect(script).toContain("curl -fsSL https://railpack.com/install.sh");
  });
});

describe("remote build result parsing", () => {
  it("parses the RESULT marker", () => {
    expect(parseRemoteBuildResult("line1\nRESULT:{\"imageTag\":\"x:latest\",\"commitSha\":\"deadbeef\"}")).toEqual({
      imageTag: "x:latest",
      commitSha: "deadbeef",
    });
  });

  it("returns null when the marker is missing", () => {
    expect(parseRemoteBuildResult("no marker here")).toBeNull();
    expect(parseRemoteBuildResult("RESULT:not-json")).toBeNull();
  });
});

describe("executor dispatch", () => {
  it("maps each mode to its executor", () => {
    expect(executorFor("local").mode).toBe("local");
    expect(executorFor("ssh").mode).toBe("ssh");
    expect(executorFor("agent").mode).toBe("agent");
  });

  it("defaults unknown modes to local", () => {
    expect(executorFor("docker_tcp").mode).toBe("local");
  });
});