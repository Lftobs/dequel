import type { Deployment, Project } from "../types";

const GIT_URL = /^https:\/\/[^\s]+$/;

export const validateRemoteDeployment = (deployment: Deployment, project: Project): string | null => {
  if (deployment.sourceType !== "git") return "Remote agents currently support Git deployments only";
  if (!GIT_URL.test(deployment.sourceRef)) return "Remote Git deployments require a public HTTPS repository URL";
  try {
    const url = new URL(deployment.sourceRef);
    if (url.username || url.password) return "Remote Git deployments require a public HTTPS repository URL";
  } catch {
    return "Remote Git deployments require a public HTTPS repository URL";
  }
  if (project.buildType !== "railpack" || project.projectType !== "web") return "Remote agents currently support Railpack web services only";
  if (project.sourceDir || project.buildCommand || project.installCommand || project.outputDir || project.startCommand) {
    return "Remote agents do not support source-directory or command overrides yet";
  }
  return null;
};
