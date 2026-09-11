import { beforeEach, describe, expect, it, mock } from "bun:test";

const fileUrl = (relPath: string) => new URL(relPath, import.meta.url).toString();

const tryRunCalls: { cmd: string; args: string[] }[] = [];
const mockTryRun = mock(async (cmd: string, args: string[]) => {
	tryRunCalls.push({ cmd, args });
});
const mockRedisDel = mock(async () => {});
const mockRedisLlLen = mock(async () => 0);
const mockRedisQuit = mock(async () => {});

beforeEach(() => {
	tryRunCalls.length = 0;
	mockTryRun.mockClear();
	mockRedisDel.mockClear();
	mockRedisLlLen.mockClear();
	mockRedisQuit.mockClear();
});

mock.module(fileUrl("../runtime"), () => ({
	tryRun: mockTryRun,
}));

mock.module(fileUrl("../../utils/config"), () => ({
	config: {
		redisUrl: "redis://localhost:6379",
	},
}));

mock.module(fileUrl("../../utils/docker-bin"), () => ({
	dockerBin: "/usr/bin/docker",
}));

mock.module("ioredis", () => ({
	default: class FakeRedis {
		llen = mockRedisLlLen;
		del = mockRedisDel;
		quit = mockRedisQuit;
	},
}));

const { pruneDocker, pruneDlq } = await import("../cleanup");

describe("pruneDocker", () => {
	beforeEach(() => {
		tryRunCalls.length = 0;
	});

	it("prunes containers with dequel label filter only", async () => {
		await pruneDocker();

		const containerPrune = tryRunCalls.find((c) => c.args[0] === "container" && c.args[1] === "prune");
		expect(containerPrune).toBeDefined();
		expect(containerPrune!.args).toContain("-f");
		expect(containerPrune!.args).toContain("--filter");
		expect(containerPrune!.args.some((a) => a.includes("com.dequel.managed"))).toBe(true);
	});

	it("prunes dangling images without -a flag (preserves cache)", async () => {
		await pruneDocker();

		const imagePrune = tryRunCalls.find((c) => c.args[0] === "image" && c.args[1] === "prune");
		expect(imagePrune).toBeDefined();
		expect(imagePrune!.args).not.toContain("-a");

		const buildxPrune = tryRunCalls.find((c) => c.args[0] === "buildx" && c.args[1] === "prune");
		expect(buildxPrune).toBeDefined();
		expect(buildxPrune!.args).not.toContain("-a");
	});
});

describe("pruneDlq", () => {
	it("does not need a Redis connection per tick (shared connection)", async () => {
		await pruneDlq();

		expect(mockRedisLlLen).toHaveBeenCalled();
		expect(mockRedisQuit).not.toHaveBeenCalled();
	});
});
