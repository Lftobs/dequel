export type RemoteGitDeployPayload = {
	deploymentId: string;
	projectId: string;
	projectName: string;
	gitUrl?: string;
	imageRef?: string;
	imagePullPolicy?: "always" | "if-not-present" | "never";
	registryAuth?: { url: string; username: string; password: string };
	containerName?: string;
	volumes?: { volumeName: string; mountPath: string }[];
	branch?: string;
	commitSha?: string;
	appPort: number;
	cpuLimit?: number;
	memoryLimitMb?: number;
	environmentVariables: { key: string; value: string }[];
};

export type RemoteRollbackPayload = {
	deploymentId: string;
	projectId: string | null;
	projectName: string | null;
	imageTag: string;
	appPort: number;
	cpuLimit?: number | null;
	memoryLimitMb?: number | null;
	environmentVariables: { key: string; value: string }[];
	volumes?: { volumeName: string; mountPath: string }[];
};

export type RemoteDestroyPayload = {
	deploymentId: string;
	containerName: string | null;
	imageTag: string | null;
	imageOwnedByDequel?: boolean;
};

export type RemoteScalePayload = {
	deploymentId: string;
	projectId: string | null;
	action: "up" | "down";
	replicas: number;
	imageTag: string;
	appPort: number;
	cpuLimit?: number | null;
	memoryLimitMb?: number | null;
	environmentVariables: { key: string; value: string }[];
};

export type RemoteRoutePayload = {
	deploymentId: string | null;
	action: "add" | "remove";
	hostname: string;
	routeFile: string;
	port: number;
	targetContainers: string[];
	upstreamHost?: string;
};

export type RemoteRouteResult = {
	routeFile: string;
	status: "active" | "removed";
};

export type RemoteDeployResult = {
	imageTag: string;
	containerName: string;
	hostPort: number;
	liveUrl: string | null;
	commitSha: string | null;
};

export type RemoteScaleResult = { replicas: number; removed: true } | { replicas: number; started: true };
