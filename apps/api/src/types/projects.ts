export type GitProvider = "github" | "gitlab" | "bitbucket" | "gitea" | "generic";
export type ImagePullPolicy = "always" | "if-not-present" | "never";
export type RestartPolicy = "no" | "always" | "unless-stopped" | "on-failure";
export type HealthCheckType = "none" | "http" | "tcp" | "command";

export interface HealthCheckConfig {
	type: HealthCheckType;
	path?: string | null;
	port?: number | null;
	command?: string | null;
	intervalSeconds?: number | null;
	timeoutSeconds?: number | null;
	startPeriodSeconds?: number | null;
	retries?: number | null;
}

export interface Project {
	id: string;
	serverId: string | null;
	name: string;
	description: string | null;
	repoUrl: string | null;
	repoBranch: string | null;
	baseDomain: string | null;
	cpuLimit: number | null;
	memoryLimitMb: number | null;
	port: number | null;
	sourceDir: string | null;
	sourceType: string;
	projectType: string;
	buildType: string;
	composeService: string | null;
	composePort: number | null;
	composeServices: string | null;
	buildCommand: string | null;
	installCommand: string | null;
	outputDir: string | null;
	startCommand: string | null;
	gitProvider: GitProvider;
	hasGitToken: boolean;
	dockerfilePath: string | null;
	dockerTarget: string | null;
	imageRef: string | null;
	imagePullPolicy: ImagePullPolicy;
	registryId: string | null;
	healthCheck: HealthCheckConfig | null;
	restartPolicy: RestartPolicy;
	restartMaxRetries: number | null;
	stopGracePeriodSeconds: number | null;
	preDeployCommand: string | null;
	postDeployCommand: string | null;
	cancelOlderDeployments: boolean;
	tags: string[];
	deployWebhookToken: string | null;
	maintenanceEnabled: boolean;
	maintenanceMessage: string | null;
	hasGithubToken: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CreateProjectInput {
	name: string;
	serverId?: string | null;
	description?: string;
	repoUrl?: string;
	repoBranch?: string;
	baseDomain?: string;
	cpuLimit?: number | null;
	memoryLimitMb?: number | null;
	port?: number | null;
	sourceDir?: string | null;
	sourceType?: string;
	projectType?: string;
	buildType?: string;
	composeService?: string | null;
	composePort?: number | null;
	composeServices?: string | null;
	buildCommand?: string | null;
	installCommand?: string | null;
	outputDir?: string | null;
	startCommand?: string | null;
	gitProvider?: GitProvider;
	gitToken?: string | null;
	dockerfilePath?: string | null;
	dockerTarget?: string | null;
	imageRef?: string | null;
	imagePullPolicy?: ImagePullPolicy;
	registryId?: string | null;
	healthCheck?: HealthCheckConfig | null;
	restartPolicy?: RestartPolicy;
	restartMaxRetries?: number | null;
	stopGracePeriodSeconds?: number | null;
	preDeployCommand?: string | null;
	postDeployCommand?: string | null;
	cancelOlderDeployments?: boolean;
	tags?: string[];
	deployWebhookToken?: string | null;
	maintenanceEnabled?: boolean;
	maintenanceMessage?: string | null;
}

export type EnvVarScope = "runtime" | "build" | "both";

export interface EnvironmentVariable {
	id: string;
	projectId: string;
	key: string;
	value: string;
	environment: string;
	scope: EnvVarScope;
	createdAt: string;
	updatedAt: string;
}

export interface CreateEnvironmentVariableInput {
	projectId: string;
	key: string;
	value: string;
	environment?: string;
	scope?: EnvVarScope;
}

export interface Volume {
	id: string;
	projectId: string;
	mountPath: string;
	sizeMb: number | null;
	dockerVolumeName: string | null;
	createdAt: string;
}

export interface CreateVolumeInput {
	projectId: string;
	mountPath?: string;
}

export interface SharedEnvVar {
	id: string;
	key: string;
	value: string;
	environment: string;
	scope: EnvVarScope;
	description: string | null;
	tags: string[];
	createdAt: string;
	updatedAt: string;
}

export interface CreateSharedEnvVarInput {
	key: string;
	value: string;
	environment?: string;
	scope?: EnvVarScope;
	description?: string;
	tags?: string[];
}
