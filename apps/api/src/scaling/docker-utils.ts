import { safeSpawn } from "../utils/process-exec";

export const run = async (cmd: string, args: string[]) => {
	const res = await safeSpawn(cmd, args, { timeoutMs: 30_000 });
	if (res.code === 0) return `${res.stdout}\n${res.stderr}`.trim();
	throw new Error(`${cmd} ${args.join(" ")} failed (${res.code}): ${res.stderr}`);
};

export const tryRun = (cmd: string, args: string[]) => run(cmd, args).catch(() => "");
