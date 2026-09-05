export type { Route } from "../../types";
export {
	acknowledgeAgentJob,
	cancelAgentJobsByDeploymentId,
	createAgentJob,
	finishAgentJob,
	getAgentJobDeploymentId,
	getAgentJobInfo,
	leaseNextAgentJob,
	listCancelledJobIds,
	requeueRunningAgentJobs,
} from "./agent-jobs";
export {
	createAgentRegistrationToken,
	exchangeAgentRegistrationToken,
	updateAgentHeartbeat,
	validateAgentCredential,
} from "./agents";
export { createAlert, deleteAlert, getAlertById, listAlerts, updateAlertEnabled } from "./alerts";
export { createApiKey, deleteApiKey, listApiKeys, validateApiKey } from "./api-keys";

export {
	createDatabase,
	deleteDatabase,
	getDatabaseById,
	listAllDatabases,
	listDatabases,
	updateDatabaseRuntime,
	updateDatabaseStatus,
} from "./databases";
export { createDeploymentEvent, listDeploymentEvents } from "./deployment-events";
export {
	appendLog,
	countDeployments,
	createDeployment,
	deleteDeploymentAndLogs,
	getDeploymentById,
	getLogs,
	listDeployments,
	updateDeploymentCommitSha,
	updateDeploymentStatus,
} from "./deployments";
export {
	createDomain,
	deleteDomain,
	getDomainById,
	listDomains,
	updateDomainSslStatus,
	updateDomainValidation,
} from "./domains";
export {
	createEnvironmentVariable,
	deleteEnvironmentVariable,
	getEnvironmentVariableById,
	getEnvironmentVariablePlaintext,
	listEnvironmentVariables,
	listEnvironmentVariablesForDeploy,
	updateEnvironmentVariable,
} from "./env-vars";
export { getGithubIntegration, setGithubIntegration } from "./github";
export { createGithubSession, deleteGithubSession, getGithubSession } from "./github-sessions";
export { getPlatformSettings, setIngressServer } from "./platform-settings";
export type { ProjectCleanupInfo } from "./projects";
export {
	createProject,
	deleteProject,
	deleteProjectCascade,
	getProjectById,
	listProjects,
	updateProject,
	updateProjectGithubToken,
} from "./projects";
export {
	deleteRoute,
	deleteRouteByHostname,
	deleteRoutesByDeployment,
	getRouteByHostname,
	listIngressRoutes,
	listRoutes,
	listRoutesByDeployment,
	updateRouteStatus,
	upsertRoute,
} from "./routes";
export { deleteScalingPolicy, getScalingPolicy, upsertScalingPolicy } from "./scaling";
export type { ServerConnection } from "./servers";
export {
	createServer,
	deleteServer,
	ensureLocalServer,
	getServerById,
	listServerConnections,
	listServers,
	updateServerStatus,
} from "./servers";
export type { SmtpSettingsData } from "./settings";
export { getSmtpSettings, upsertSmtpSettings } from "./settings";
export {
	createSharedEnvVar,
	deleteSharedEnvVar,
	getSharedEnvVarById,
	getSharedEnvVarPlaintext,
	linkSharedEnvVarsToProject,
	listLinkedSharedEnvVars,
	listSharedEnvVars,
	listSharedEnvVarsForDeploy,
	unlinkSharedEnvVarFromProject,
	updateSharedEnvVar,
} from "./shared-env-vars";
export {
	createSshKey,
	deleteSshKey,
	getSshKeyById,
	getSshKeyPrivateKey,
	listSshKeys,
	resolveServerSshKey,
} from "./ssh-keys";
export { createVolume, deleteVolume, getVolumeById, listVolumes } from "./volumes";
