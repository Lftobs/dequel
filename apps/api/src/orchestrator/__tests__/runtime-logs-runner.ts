import { mock } from "bun:test";

const fileUrl = (relPath: string) => new URL(relPath, import.meta.url).toString();

const servers: Record<string, any> = {
	"srv-worker": { id: "srv-worker", mode: "ssh", host: "1.2.3.4", port: 22 },
};

const dockerCalls: any[][] = [];
const targetArgsCalls: any[] = [];

mock.module(fileUrl("../../db/repo"), () => ({
	getServerById: mock((id: string) => Promise.resolve(servers[id] ?? null)),
}));

mock.module(fileUrl("../../utils/docker-run"), () => ({
	dockerRun: mock((...args: any[]) => {
		dockerCalls.push(args);
		return Promise.resolve("line one\nline two");
	}),
	getDockerTargetArgs: mock((server: any) => {
		targetArgsCalls.push(server);
		return server?.mode === "ssh" ? ["-H", `ssh://root@${server.host}:${server.port}`] : [];
	}),
}));

try {
	const { readRuntimeLogs, runtimeLogFollowerArgs } = await import("../runtime-logs");

	const results: any = {};

	const lines = await readRuntimeLogs({ id: "dep-1", containerName: "app-old", serverId: "srv-worker" });
	results.readOnRemote = {
		count: lines.length,
		first: { sequence: lines[0].sequence, message: lines[0].message, stage: lines[0].stage },
		serverPassed: dockerCalls[0][2]?.id === "srv-worker",
		command: dockerCalls[0].slice(0, 2),
	};

	dockerCalls.length = 0;
	const localLines = await readRuntimeLogs({ id: "dep-2", containerName: null, serverId: null });
	results.readLocal = {
		count: localLines.length,
		command: dockerCalls[0].slice(0, 2),
		serverNull: dockerCalls[0][2] === null,
	};

	targetArgsCalls.length = 0;
	const followerArgs = await runtimeLogFollowerArgs({ id: "dep-3", containerName: "app-1", serverId: "srv-worker" });
	results.follower = {
		args: followerArgs,
		serverPassed: targetArgsCalls[0]?.id === "srv-worker",
	};

	targetArgsCalls.length = 0;
	const localArgs = await runtimeLogFollowerArgs({ id: "dep-4", containerName: null, serverId: null });
	results.followerLocal = {
		args: localArgs,
		serverNull: targetArgsCalls[0] === null,
	};

	console.log(JSON.stringify(results));
} catch (err: any) {
	console.error("Runner error:", err?.message ?? String(err));
	console.error(err?.stack ?? err);
	process.exit(1);
}
