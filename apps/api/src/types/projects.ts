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
}

export interface EnvironmentVariable {
	id: string;
	projectId: string;
	key: string;
	value: string;
	environment: string;
	createdAt: string;
	updatedAt: string;
}

export interface CreateEnvironmentVariableInput {
	projectId: string;
	key: string;
	value: string;
	environment?: string;
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
	description: string | null;
	tags: string[];
	createdAt: string;
	updatedAt: string;
}

export interface CreateSharedEnvVarInput {
	key: string;
	value: string;
	environment?: string;
	description?: string;
	tags?: string[];
}
