import { availableParallelism, freemem, totalmem, arch } from "node:os";
import { statfs } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { AgentCapabilities } from "./protocol";

const succeeds = (command: string, args: string[]) => new Promise<boolean>((resolve) => {
  const child = spawn(command, args, { stdio: "ignore" });
  child.on("error", () => resolve(false));
  child.on("close", (code) => resolve(code === 0));
});

export const collectCapabilities = async (): Promise<AgentCapabilities> => {
  const [docker, buildkit, caddy, compose, disk] = await Promise.all([
    succeeds("docker", ["info"]),
    succeeds("docker", ["buildx", "version"]),
    succeeds("caddy", ["version"]),
    succeeds("docker", ["compose", "version"]),
    statfs("/").catch(() => null),
  ]);
  return {
    docker,
    buildkit,
    caddy,
    compose,
    architectures: [arch()],
    cpuCount: availableParallelism(),
    memoryBytes: totalmem(),
    diskBytes: disk ? disk.blocks * disk.bsize : 0,
  };
};

export const collectResourceUsage = () => ({
  memoryUsedMb: Math.round((totalmem() - freemem()) / 1024 / 1024),
});
