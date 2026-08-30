import { describe, expect, it } from "bun:test";
import { validateDeploymentPayload, validateDestroyPayload, validateRollbackPayload, validateScalePayload, validateRoutePayload } from "./executor";

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

describe("remote scale payload", () => {
  const scalePayload = {
    deploymentId: "deployment-1",
    projectId: "project-1",
    action: "up" as const,
    replicas: 2,
    imageTag: "dequel-example-api:deployment-1234",
    appPort: 3000,
    cpuLimit: 0.5,
    memoryLimitMb: 512,
    environmentVariables: [{ key: "PORT", value: "3000" }],
  };

  it("accepts a valid scale payload", () => {
    expect(validateScalePayload(scalePayload)).toEqual(scalePayload);
  });

  it("rejects an unknown action", () => {
    expect(() => validateScalePayload({ ...scalePayload, action: "sideways" })).toThrow("Invalid scale action");
  });

  it("rejects replicas out of range", () => {
    expect(() => validateScalePayload({ ...scalePayload, replicas: 0 })).toThrow("Invalid replica count");
    expect(() => validateScalePayload({ ...scalePayload, replicas: 51 })).toThrow("Invalid replica count");
  });

  it("rejects unsafe environment variable keys", () => {
    expect(() => validateScalePayload({
      ...scalePayload,
      environmentVariables: [{ key: "X; rm -rf /", value: "1" }],
    })).toThrow("Invalid environment variables");
  });

  it("rejects missing required fields for a down action", () => {
    expect(() => validateScalePayload({
      deploymentId: "deployment-1",
      action: "down",
      replicas: 1,
    })).toThrow();
  });
});

describe("remote route payload", () => {
  const routePayload = {
    deploymentId: "deployment-1",
    action: "add" as const,
    hostname: "example-api.localhost:80",
    routeFile: "example-api.caddy",
    port: 3000,
    targetContainers: ["deploy-deployment-1"],
  };

  it("accepts a valid add payload", () => {
    expect(validateRoutePayload(routePayload)).toEqual(routePayload);
  });

  it("accepts a remove action with a single target", () => {
    expect(validateRoutePayload({
      deploymentId: "deployment-1",
      action: "remove",
      hostname: "example-api.localhost:80",
      routeFile: "example-api.caddy",
      port: 3000,
      targetContainers: ["deploy-deployment-1"],
    }).action).toBe("remove");
  });

  it("rejects an unknown action", () => {
    expect(() => validateRoutePayload({ ...routePayload, action: "nope" })).toThrow("Invalid route action");
  });

  it("rejects hostnames with unsafe characters", () => {
    expect(() => validateRoutePayload({ ...routePayload, hostname: "x; rm -rf /" })).toThrow("Invalid hostname");
  });

  it("rejects route file names that are not .caddy", () => {
    expect(() => validateRoutePayload({ ...routePayload, routeFile: "../../etc/passwd" })).toThrow("Invalid route file name");
  });

  it("rejects empty target containers", () => {
    expect(() => validateRoutePayload({ ...routePayload, targetContainers: [] })).toThrow("Invalid target containers");
  });
});
