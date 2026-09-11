import { mock } from "bun:test";
import http from "node:http";

const fileUrl = (relPath: string) => new URL(relPath, import.meta.url).toString();

let platformSettings: { ingressServerId: string | null } = { ingressServerId: null };
let servers: any[] = [];
let projects: any[] = [];
let routesByServer: Record<string, any[]> = {};
let removedRouteFiles: { hostname: string; routeFile: string }[] = [];
let routeStatusUpdates: { hostname: string; status: string; serverId?: string }[] = [];
let reachableHosts: Set<string> = new Set();

mock.module(fileUrl("../../db/repo"), () => ({
	getPlatformSettings: mock(() => Promise.resolve(platformSettings)),
	getProjectById: mock((id: string) => Promise.resolve(projects.find((p) => p.id === id) ?? null)),
	getServerById: mock((id: string) => Promise.resolve(servers.find((s) => s.id === id) ?? null)),
	listProjects: mock(() => Promise.resolve(projects)),
	listDeployments: mock(() => Promise.resolve([])),
	createDeployment: mock(() => Promise.resolve({ id: "dep-new" })),
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
	updateRouteStatus: mock((hostname: string, status: string, _lastError: any, serverId?: string) => {
		routeStatusUpdates.push({ hostname, status, serverId });
		return Promise.resolve();
	}),
	updateDomainValidation: mock(() => Promise.resolve()),
	deleteRoutesByDeployment: mock(() => Promise.resolve()),
	getLogs: mock(() => Promise.resolve([])),
	createAgentJob: mock(() => Promise.resolve("job-1")),
	upsertRoute: mock(() => Promise.resolve({})),
	listRoutes: mock((serverId?: string) => Promise.resolve(serverId ? (routesByServer[serverId] ?? []) : [])),
	updateServerStatus: mock(() => Promise.resolve()),
	createAgentRegistrationToken: mock(() => Promise.resolve({ token: "dqr_test", expiresAt: new Date().toISOString() })),
	listServers: mock(() => Promise.resolve(servers)),
	ensureLocalServer: mock(() => Promise.resolve()),
	createDeploymentEvent: mock(() => Promise.resolve()),
}));

mock.module(fileUrl("../../utils/ingress.ts"), () => ({
	getIngressServer: mock(() => {
		if (!platformSettings.ingressServerId) return Promise.resolve(null);
		return Promise.resolve(servers.find((s) => s.id === platformSettings.ingressServerId) ?? null);
	}),
	removeIngressRouteFile: mock((_ingressServer: any, info: { hostname: string; routeFile: string }) => {
		removedRouteFiles.push(info);
		return Promise.resolve();
	}),
	syncIngressRoute: mock(() => Promise.resolve()),
	shouldRouteViaIngress: mock(() => true),
	upsertIngressRoute: mock(() => Promise.resolve()),
}));

const _origHttpGet = http.get;
(http as any).get = mock((url: string, _opts: any, cb: any) => {
	const host = new URL(url).hostname;
	const reachable = reachableHosts.has(host);
	const req = {
		on: mock(() => req),
		destroy: mock(() => {}),
	};
	if (reachable) {
		process.nextTick(() => cb({ statusCode: 200, resume: mock(() => {}) }));
	} else {
		process.nextTick(() => {
			const errCb = req.on.mock.calls.find((c: any) => c[0] === "error")?.[1];
			if (errCb) errCb(new Error("ECONNREFUSED"));
		});
	}
	return req;
});

const { failoverMonitorTick } = await import("../failover");

const results: any = {};

// Test 1: clean up stale routes on recovery
platformSettings = { ingressServerId: "ing" };
servers = [
	{ id: "ing", name: "Ingress", mode: "ssh" },
	{ id: "srv-a", name: "ServerA", mode: "ssh", host: "10.0.0.1", status: "connected" },
	{ id: "srv-b", name: "ServerB", mode: "ssh", host: "10.0.0.2", status: "connected" },
];
projects = [
	{ id: "p1", name: "proj-1", serverId: "srv-a" },
	{ id: "p2", name: "proj-2", serverId: "srv-b" },
];
routesByServer = {
	"srv-a": [{ id: "r1", projectId: "p1", hostname: "p1.app.com", routeFile: "p1.conf", status: "active" }],
};
removedRouteFiles = [];
routeStatusUpdates = [];
reachableHosts = new Set(["10.0.0.2"]);

await failoverMonitorTick();

results.test1_firstTick = {
	removedEmpty: removedRouteFiles.length === 0,
	updatesEmpty: routeStatusUpdates.length === 0,
};

projects = [
	{ id: "p1", name: "proj-1", serverId: "srv-b" },
	{ id: "p2", name: "proj-2", serverId: "srv-b" },
];
reachableHosts.add("10.0.0.1");
await failoverMonitorTick();

results.test1_recovered = {
	removedFiles: removedRouteFiles,
	updates: routeStatusUpdates,
};

// Test 2: no cleanup when server was never unreachable
removedRouteFiles = [];
routeStatusUpdates = [];
reachableHosts = new Set(["10.0.0.1"]);
projects = [{ id: "p1", name: "proj-1", serverId: "srv-a" }];
routesByServer = {
	"srv-a": [{ id: "r1", projectId: "p1", hostname: "p1.app.com", routeFile: "p1.conf", status: "active" }],
};

await failoverMonitorTick();

results.test2 = { removedEmpty: removedRouteFiles.length === 0, updatesEmpty: routeStatusUpdates.length === 0 };

// Test 3: keep routes when recovered server is still the project server
removedRouteFiles = [];
routeStatusUpdates = [];
reachableHosts = new Set();
projects = [{ id: "p1", name: "proj-1", serverId: "srv-a" }];
routesByServer = {
	"srv-a": [{ id: "r1", projectId: "p1", hostname: "p1.app.com", routeFile: "p1.conf", status: "active" }],
};

await failoverMonitorTick();
reachableHosts.add("10.0.0.1");
await failoverMonitorTick();

results.test3 = { removedEmpty: removedRouteFiles.length === 0, updatesEmpty: routeStatusUpdates.length === 0 };

console.log(JSON.stringify(results));
