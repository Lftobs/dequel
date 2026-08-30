export {
  createDeployment, listDeployments, countDeployments, getDeploymentById,
  updateDeploymentCommitSha, updateDeploymentStatus, deleteDeploymentAndLogs,
  appendLog, getLogs,
} from "./deployments";

export {
  createProject, updateProjectGithubToken, listProjects, getProjectById,
  updateProject, deleteProject, deleteProjectCascade,
} from "./projects";
export type { ProjectCleanupInfo } from "./projects";

export {
  createEnvironmentVariable, listEnvironmentVariables, getEnvironmentVariablePlaintext,
  getEnvironmentVariableById, updateEnvironmentVariable, listEnvironmentVariablesForDeploy,
  deleteEnvironmentVariable,
} from "./env-vars";

export { createVolume, listVolumes, getVolumeById, deleteVolume } from "./volumes";

export {
  createDatabase, listAllDatabases, listDatabases, getDatabaseById,
  updateDatabaseStatus, updateDatabaseRuntime, deleteDatabase,
} from "./databases";

export {
  createDomain, listDomains, getDomainById, updateDomainValidation,
  updateDomainSslStatus, deleteDomain,
} from "./domains";

export { upsertScalingPolicy, getScalingPolicy, deleteScalingPolicy } from "./scaling";

export {
  createServer, listServers, listServerConnections, getServerById,
  ensureLocalServer, updateServerStatus, deleteServer,
} from "./servers";
export type { ServerConnection } from "./servers";

export {
  createAgentRegistrationToken, exchangeAgentRegistrationToken,
  validateAgentCredential, updateAgentHeartbeat,
} from "./agents";

export {
  createAgentJob, leaseNextAgentJob, acknowledgeAgentJob,
  getAgentJobDeploymentId, getAgentJobInfo, finishAgentJob, requeueRunningAgentJobs,
  cancelAgentJobsByDeploymentId, listCancelledJobIds,
} from "./agent-jobs";

export { createApiKey, listApiKeys, deleteApiKey, validateApiKey } from "./api-keys";

export { createAlert, listAlerts, getAlertById, updateAlertEnabled, deleteAlert } from "./alerts";

export { getGithubIntegration, setGithubIntegration } from "./github";

export { getSmtpSettings, upsertSmtpSettings } from "./settings";
export type { SmtpSettingsData } from "./settings";

export { upsertRoute, getRouteByHostname, listRoutes, listIngressRoutes, updateRouteStatus, deleteRouteByHostname, deleteRoute, deleteRoutesByDeployment } from "./routes";

export { getPlatformSettings, setIngressServer } from "./platform-settings";
export type { Route } from "../../types";

export { createDeploymentEvent, listDeploymentEvents } from "./deployment-events";
