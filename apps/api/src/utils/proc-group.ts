import type { ChildProcess } from "node:child_process";

export const killChildTree = (child: ChildProcess, signal: NodeJS.Signals = "SIGTERM"): void => {
	if (child.pid == null) return;
	try {
		process.kill(-child.pid, signal);
	} catch {
		try {
			child.kill(signal);
		} catch {}
	}
};
