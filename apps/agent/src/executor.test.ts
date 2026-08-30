import { describe, expect, it } from "bun:test";
import { validateDeploymentPayload, validateDestroyPayload, validateRollbackPayload } from "./executor";

const payload = {
  deploymentId: "deployment-1",
  projectId: "project-1",
  projectName: "Example API",
  gitUrl: "https://github.com/example/api.git",
  branch: "main",
  appPort: 3000,
  environmentVariables: [{ key: "NODE_ENV", value: "production" }],
};

const rollbackPayload = {
  deploymentId: "deployment-1",
  projectId: "project-1",
  projectName: "Example API",
  imageTag: "dequel-example-api:deployment-1234",
  appPort: 3000,
  environmentVariables: [{ key: "NODE_ENV", value: "production" }],
  volumes: [{ volumeName: "vol-project-1", mountPath: "/app/data" }],
};

describe("remote deployment payload", () => {
  it("accepts a constrained public Git deployment", () => {
    expect(validateDeploymentPayload(payload)).toEqual(payload);
  });

  it("rejects repository credentials embedded in URLs", () => {
    expect(() => validateDeploymentPayload({
      ...payload,
      gitUrl: "https://token@github.com/example/api.git",
    })).toThrow("Only public HTTPS Git URLs are supported");
  });

  it("rejects unsafe environment names", () => {
    expect(() => validateDeploymentPayload({
      ...payload,
      environmentVariables: [{ key: "BAD-KEY", value: "value" }],
    })).toThrow("Invalid environment variables");
  });

  it("rejects branches that can be interpreted as command options", () => {
    expect(() => validateDeploymentPayload({ ...payload, branch: "--upload-pack=evil" })).toThrow("Invalid Git branch");
  });
});

describe("remote rollback payload", () => {
  it("accepts a valid rollback payload", () => {
    expect(validateRollbackPayload(rollbackPayload)).toEqual(rollbackPayload);
  });

  it("accepts null project and volumes", () => {
    expect(validateRollbackPayload({
      deploymentId: "deployment-1",
      projectId: null,
      projectName: null,
      imageTag: "dequel-app:deployment-1234",
      appPort: 3000,
      environmentVariables: [],
      volumes: undefined,
    }).projectId).toBeNull();
  });

  it("rejects image tags without a tag suffix", () => {
    expect(() => validateRollbackPayload({ ...rollbackPayload, imageTag: "dequel-app" })).toThrow("Invalid image tag");
  });

  it("rejects volumes with unsafe paths", () => {
    expect(() => validateRollbackPayload({
      ...rollbackPayload,
      volumes: [{ volumeName: "vol-1", mountPath: "../../etc" }],
    })).toThrow("Invalid volumes");
  });
});

describe("remote destroy payload", () => {
  it("accepts a valid destroy payload", () => {
    expect(validateDestroyPayload({
      deploymentId: "deployment-1",
      containerName: "example-api-deploym",
      imageTag: "dequel-example-api:deployment-1234",
    })).toEqual({
      deploymentId: "deployment-1",
      containerName: "example-api-deploym",
      imageTag: "dequel-example-api:deployment-1234",
    });
  });

  it("rejects container names with unsafe characters", () => {
    expect(() => validateDestroyPayload({
      deploymentId: "deployment-1",
      containerName: "rm -rf /",
      imageTag: null,
    })).toThrow("Invalid container name");
  });
});
