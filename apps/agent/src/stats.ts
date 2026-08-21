import { spawn } from "node:child_process";
import type { AgentContainerStat } from "./protocol";

const run = (command: string, args: string[]) => new Promise<string>((resolve, reject) => {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += String(chunk); });
  child.stderr.on("data", (chunk) => { stderr += String(chunk); });
  child.on("close", (code) => {
    if (code === 0) resolve(stdout.trim());
    else reject(new Error(`${command} failed (${code}): ${stderr.trim()}`));
  });
  child.on("error", () => reject(new Error(`${command} not available`)));
});

let cached: { at: number; stats: AgentContainerStat[] } | null = null;

export const collectContainerStats = async (): Promise<AgentContainerStat[]> => {
  if (cached && Date.now() - cached.at < 30_000) return cached.stats;
  const stats: AgentContainerStat[] = [];
  try {
    const ids = (await run("docker", ["ps", "-q", "--filter", "label=com.dequel.managed=true"]))
      .split("\n").map((id) => id.trim()).filter(Boolean);
    for (const id of ids) {
      const name = (await run("docker", ["inspect", "--format", "{{.Name}}", id])).replace(/^\//, "");
      const raw = await run("docker", ["stats", "--no-stream", "--format", "{{json .}}", id]);
      const parsed = JSON.parse(raw);
      const cpuPercent = parseFloat(String(parsed.CPUPerc ?? "0").replace("%", ""));
      const memStr = String(parsed.MemUsage ?? "0B").split("/")[0]?.trim() ?? "0B";
      const projectId = await run("docker", ["inspect", "--format", "{{index .Config.Labels \"com.dequel.project\"}}", id]).catch(() => "");
      const replica = await run("docker", ["inspect", "--format", "{{index .Config.Labels \"com.dequel.replica\"}}", id]).catch(() => "");
      stats.push({
        containerName: name,
        cpuPercent,
        memoryMb: parseMemToMb(memStr),
        projectId: projectId.trim() || undefined,
        replica: replica.trim() === "1",
      });
    }
  } catch {
    return cached?.stats ?? [];
  }
  cached = { at: Date.now(), stats };
  return stats;
};

const parseMemToMb = (mem: string): number => {
  const match = mem.match(/^([\d.]+)(\w+)$/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  switch (match[2]) {
    case "GiB": case "GB": return val * 1024;
    case "MiB": case "MB": return val;
    case "KiB": case "KB": return val / 1024;
    default: return val;
  }
};
