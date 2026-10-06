import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";

export interface SafeSpawnOptions extends Omit<SpawnOptions, "signal"> {
	timeoutMs?: number;
	signal?: AbortSignal;
	onLine?: (line: string) => void;
	killSignalTimeoutMs?: number;
}

export interface SafeSpawnResult {
	code: number;
	stdout: string;
	stderr: string;
}

export function killProcessGroup(child: ChildProcess, signal: NodeJS.Signals | number = "SIGTERM"): void {
	if (!child.pid) return;
	const isPosix = process.platform !== "win32";

	if (isPosix) {
		try {
			process.kill(-child.pid, signal);
			return;
		} catch (err: unknown) {
			const code = (err as NodeJS.ErrnoException).code;
			if (code === "ESRCH") return;
		}
	}

	try {
		child.kill(signal);
	} catch {}
}

export function terminateWithEscalation(child: ChildProcess, escalationGraceMs = 4000): { cancel: () => void } {
	let cancelled = false;
	let timer: ReturnType<typeof setTimeout> | null = null;

	killProcessGroup(child, "SIGTERM");

	timer = setTimeout(() => {
		if (cancelled) return;
		killProcessGroup(child, "SIGKILL");
	}, escalationGraceMs);

	if (typeof timer.unref === "function") {
		timer.unref();
	}

	const onExit = () => {
		cancelled = true;
		if (timer) clearTimeout(timer);
	};

	child.once("exit", onExit);
	child.once("close", onExit);

	return {
		cancel: () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
		},
	};
}

let reaperInitialized = false;

export function initZombieReaper(): void {
	if (reaperInitialized) return;
	reaperInitialized = true;

	if (process.platform !== "linux") return;

	try {
		const { dlopen, FFIType } = require("bun:ffi");
		const libc = dlopen("libc.so.6", {
			waitpid: {
				args: [FFIType.i32, FFIType.ptr, FFIType.i32],
				returns: FFIType.i32,
			},
		});

		const reap = () => {
			try {
				while (libc.symbols.waitpid(-1, null, 1) > 0) {}
			} catch {}
		};

		process.on("SIGCHLD", reap);
	} catch {}
}

export function safeSpawn(cmd: string, args: string[], options: SafeSpawnOptions = {}): Promise<SafeSpawnResult> {
	return new Promise((resolve, reject) => {
		const isPosix = process.platform !== "win32";
		const { signal, timeoutMs, onLine, killSignalTimeoutMs, ...spawnOpts } = options;

		const child = spawn(cmd, args, {
			...spawnOpts,
			detached: spawnOpts.detached ?? isPosix,
			stdio: spawnOpts.stdio ?? ["ignore", "pipe", "pipe"],
			env: {
				GIT_TERMINAL_PROMPT: "0",
				SSH_ASKPASS: "",
				...process.env,
				...options.env,
			},
		});

		let stdout = "";
		let stderr = "";
		let settled = false;
		let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
		let terminationHandle: { cancel: () => void } | null = null;
		let abortError: Error | null = null;

		const cleanup = () => {
			settled = true;
			if (timeoutTimer) clearTimeout(timeoutTimer);
			if (terminationHandle) terminationHandle.cancel();
			if (signal) {
				signal.removeEventListener("abort", onAbort);
			}
		};

		const terminate = (err?: Error) => {
			if (settled) return;
			if (err) abortError = err;
			terminationHandle = terminateWithEscalation(child, killSignalTimeoutMs ?? 4000);
		};

		const onAbort = () => {
			terminate(new Error(`${cmd} aborted`));
		};

		if (signal) {
			if (signal.aborted) {
				onAbort();
			} else {
				signal.addEventListener("abort", onAbort, { once: true });
			}
		}

		if (timeoutMs && timeoutMs > 0) {
			timeoutTimer = setTimeout(() => {
				terminate(new Error(`${cmd} timed out after ${timeoutMs}ms`));
			}, timeoutMs);
			if (typeof timeoutTimer.unref === "function") {
				timeoutTimer.unref();
			}
		}

		child.stdout?.on("data", (chunk: Buffer | string) => {
			const str = String(chunk);
			stdout += str;
			if (onLine) {
				for (const line of str.split("\n").filter(Boolean)) {
					onLine(line);
				}
			}
		});

		child.stderr?.on("data", (chunk: Buffer | string) => {
			const str = String(chunk);
			stderr += str;
			if (onLine) {
				for (const line of str.split("\n").filter(Boolean)) {
					onLine(line);
				}
			}
		});

		child.on("error", (err) => {
			cleanup();
			reject(err);
		});

		child.on("close", (code) => {
			cleanup();
			if (abortError) {
				reject(abortError);
				return;
			}
			resolve({
				code: code ?? 1,
				stdout: stdout.trim(),
				stderr: stderr.trim(),
			});
		});
	});
}
