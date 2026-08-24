import type { Deployment, Project } from "../types";

const GIT_URL = /^https:\/\/[^\s]+$/;
const PRIVATE_IP_RE = /(?::\/\/|^)(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/;

export const validateRemoteDeployment = (deployment: Deployment, project: Project): string | null => {
  if (deployment.sourceType !== "git") return "Remote agents currently support Git deployments only";
  if (!GIT_URL.test(deployment.sourceRef)) return "Remote Git deployments require a public HTTPS repository URL";
  try {
    const url = new URL(deployment.sourceRef);
    if (url.username || url.password) return "Remote Git deployments require a public HTTPS repository URL";
    if (PRIVATE_IP_RE.test(url.hostname)) return "Remote Git deployments cannot target private-network endpoints";
  } catch {
    return "Remote Git deployments require a public HTTPS repository URL";
  }
  if (project.buildType !== "railpack" || project.projectType !== "web") return "Remote agents currently support Railpack web services only";
  if (project.sourceDir || project.buildCommand || project.installCommand || project.outputDir || project.startCommand) {
    return "Remote agents do not support source-directory or command overrides yet";
  }
  return null;
};
