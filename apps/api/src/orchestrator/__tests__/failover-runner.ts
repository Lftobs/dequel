import { mock } from "bun:test";

const fileUrl = (relPath: string) => new URL(relPath, import.meta.url).toString();

let platformSettings: { ingressServerId: string | null } = { ingressServerId: null };
let servers: any[] = [];
let projects: any[] = [];
let deploymentsByProject: Record<string, any[]> = {};

mock.module(fileUrl("../../db/repo"), () => ({
	getPlatformSettings: mock(() => Promise.resolve(platformSettings)),
	getProjectById: mock((id: string) => Promise.resolve(projects.find((p) => p.id === id) ?? null)),
	getServerById: mock((id: string) => Promise.resolve(servers.find((s) => s.id === id) ?? null)),
	listProjects: mock(() => Promise.resolve(projects)),
	listDeployments: mock((projectId?: string) =>
		Promise.resolve(projectId ? (deploymentsByProject[projectId] ?? []) : []),
	),
	createDeployment: mock((input: any) => Promise.resolve({ id: "dep-new", ...input })),
	updateProject: mock(() => Promise.resolve()),
	updateDeploymentStatus: mock(() => Promise.resolve()),
	appendLog: mock(() => Promise.resolve({ sequence: 1 })),
	listDomains: mock(() => Promise.resolve([])),
	listEnvironmentVariablesForDeploy: mock(() => Promise.resolve([])),
	listVolumes: mock(() => Promise.resolve([])),
	updateDeploymentCommitSha: mock(() => Promise.resolve()),
	getDeploymentById: mock(() => Promise.resolve(null)),
	getScalingPolicy: mock(() => Promise.resolve(null)),
	deleteDeploymentAndLogs: mock(() => Promise.resolve()),
	listAllDatabases: mock(() => Promise.resolve([])),
	updateRouteStatus: mock(() => Promise.resolve()),
	updateDomainValidation: mock(() => Promise.resolve()),
	deleteRoutesByDeployment: mock(() => Promise.resolve()),
	getLogs: mock(() => Promise.resolve([])),
	createAgentJob: mock(() => Promise.resolve("job-1")),
	upsertRoute: mock(() => Promise.resolve({})),
	listRoutes: mock(() => Promise.resolve([])),
	updateServerStatus: mock(() => Promise.resolve()),
	createAgentRegistrationToken: mock(() => Promise.resolve({ token: "dqr_test", expiresAt: new Date().toISOString() })),
	listServers: mock(() => Promise.resolve(servers)),
	ensureLocalServer: mock(() => Promise.resolve()),
	createDeploymentEvent: mock(() => Promise.resolve()),
}));

mock.module(fileUrl("../../executors/dispatch"), () => ({
	executorFor: mock(() => ({
		deploy: mock(() => Promise.resolve({ ok: true })),
	})),
}));

const { failoverProject } = await import("../failover");

const results: any = {};

// Test 1: defaults to local ingress when none configured
try {
	platformSettings = { ingressServerId: null };
	projects = [{ id: "p1", serverId: "a" }];
	servers = [{ id: "a", name: "AppServer", mode: "ssh", status: "connected" }];
	deploymentsByProject = {
		p1: [{ id: "dep-1", sourceType: "git", sourceRef: "https://github.com/x/y.git", branch: "main" }],
	};
	await failoverProject("p1");
	results.test1 = { ok: false, error: "should have thrown" };
} catch (e: any) {
	results.test1 = { ok: e.message?.includes("No other healthy server available") };
}

// Test 2: rejects non-ssh project servers
try {
	platformSettings = { ingressServerId: "ing" };
	servers = [{ id: "ing", name: "Ingress", mode: "ssh" }];
	projects = [{ id: "p1", serverId: "a" }];
	servers.push({ id: "a", name: "AgentServer", mode: "agent" });
	await failoverProject("p1");
	results.test2 = { ok: false, error: "should have thrown" };
} catch (e: any) {
	results.test2 = { ok: e.message?.includes("only supports SSH project servers") };
}

// Test 3: rejects when no other healthy server exists
try {
	platformSettings = { ingressServerId: "ing" };
	servers = [{ id: "ing", name: "Ingress", mode: "ssh" }];
	projects = [{ id: "p1", serverId: "a" }];
	servers.push({ id: "a", name: "AppServer", mode: "ssh", status: "connected" });
	deploymentsByProject = {
		p1: [{ id: "dep-1", sourceType: "git", sourceRef: "https://github.com/x/y.git", branch: "main" }],
	};
	await failoverProject("p1");
	results.test3 = { ok: false, error: "should have thrown" };
} catch (e: any) {
	results.test3 = { ok: e.message?.includes("No other healthy server available") };
}

// Test 4: rejects when only agent servers are available as targets
try {
	platformSettings = { ingressServerId: "ing" };
	servers = [
		{ id: "ing", name: "Ingress", mode: "ssh" },
		{ id: "a", name: "Current", mode: "ssh", status: "connected" },
		{ id: "b", name: "Agent", mode: "agent", lastHeartbeat: new Date().toISOString() },
	];
	projects = [{ id: "p1", serverId: "a" }];
	deploymentsByProject = {
		p1: [{ id: "dep-1", sourceType: "git", sourceRef: "https://github.com/x/y.git", branch: "main" }],
	};
	await failoverProject("p1");
	results.test4 = { ok: false, error: "should have thrown" };
} catch (e: any) {
	results.test4 = { ok: e.message?.includes("No other healthy server available") };
}

// Test 5: delegates to ssh executor and marks old deployment inactive
try {
	platformSettings = { ingressServerId: "ing" };
	servers = [
		{ id: "ing", name: "Ingress", mode: "ssh" },
		{ id: "a", name: "Current", mode: "ssh", status: "connected" },
		{ id: "b", name: "Target", mode: "ssh", status: "connected" },
	];
	projects = [{ id: "p1", name: "proj-1", serverId: "a" }];
	deploymentsByProject = {
		p1: [{ id: "dep-1", sourceType: "git", sourceRef: "https://github.com/x/y.git", branch: "main" }],
	};

	const deployment = await failoverProject("p1");
	const updateProjectCall = (await import("../../db/repo")).updateProject as any;
	const wasReassigned = updateProjectCall.mock.calls.some(
		(call: any[]) => call[0] === "p1" && call[1]?.serverId === "b",
	);
	results.test5 = { ok: deployment.id === "dep-new" && deployment.serverId === "b" && wasReassigned };
} catch (e: any) {
	results.test5 = { ok: false, error: e.message };
}

console.log(JSON.stringify(results));
