import type { Deployment, Project, Server } from "../../types";

export interface ExecutorDeployInput {
	deployment: Deployment;
	project: Project | null;
	server: Server;
}

export interface ExecutorRollbackInput {
	deployment: Deployment;
	project: Project | null;
	server: Server;
	imageTag: string;
}

export interface ExecutorDestroyInput {
	deployment: Deployment;
	project: Project | null;
	server: Server;
}

export interface ExecutorCancelInput {
	deployment: Deployment;
	server: Server;
}

export interface DeploymentExecutor {
	readonly mode: string;
	deploy(input: ExecutorDeployInput): Promise<void>;
	rollback(input: ExecutorRollbackInput): Promise<void>;
	destroy(input: ExecutorDestroyInput): Promise<void>;
	cancel(input: ExecutorCancelInput): Promise<void>;
}
