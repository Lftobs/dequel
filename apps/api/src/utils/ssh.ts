import { spawn } from "node:child_process";
import type { Server } from "../types";

export interface SshExecutionOptions {
  env?: Record<string, string>;
  onLog?: (line: string) => Promise<void> | void;
  signal?: AbortSignal;
}

export const getDockerSshTarget = (server: Server | { host: string; port?: number; sshUser?: string | null }): string => {
  const user = server.sshUser || "root";
  const port = server.port || 22;
  return `ssh://${user}@${server.host}:${port}`;
};

export const testSshConnection = (server: { host: string; port?: number; sshUser?: string | null }): Promise<boolean> => {
  return new Promise((resolve) => {
    const target = getDockerSshTarget(server);
    const child = spawn("docker", ["-H", target, "info", "--format", "{{.ServerVersion}}"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout?.on("data", (chunk) => { output += String(chunk); });
    child.on("close", (code) => {
      resolve(code === 0 && output.trim().length > 0);
    });
    child.on("error", () => resolve(false));
  });
};

export const execDockerSshCommand = (
  server: Server | { host: string; port?: number; sshUser?: string | null },
  args: string[],
  options: SshExecutionOptions = {}
): Promise<{ code: number; stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    const target = getDockerSshTarget(server);
    const fullArgs = ["-H", target, ...args];
    const child = spawn("docker", fullArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...options.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      if (options.onLog) {
        text.split("\n").filter(Boolean).forEach((line) => options.onLog!(line));
      }
    });

    child.stderr?.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      if (options.onLog) {
        text.split("\n").filter(Boolean).forEach((line) => options.onLog!(line));
      }
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim() });
    });

    child.on("error", (err) => reject(err));

    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        child.kill("SIGTERM");
        reject(new Error("SSH docker command aborted"));
      });
    }
  });
};

export const syncRemoteCaddyRoute = (
  server: Server | { host: string; port?: number; sshUser?: string | null },
  filename: string,
  content: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    const user = server.sshUser || "root";
    const port = server.port || 22;
    // Writes route file via SSH tee command to /etc/caddy/routes/ or caddy reload
    const sshCmd = spawn("ssh", [
      "-p", String(port),
      "-o", "StrictHostKeyChecking=no",
      `${user}@${server.host}`,
      `mkdir -p /etc/caddy/routes && cat > /etc/caddy/routes/${filename} && (caddy reload --config /etc/caddy/Caddyfile || docker exec dequel-caddy caddy reload || true)`
    ], { stdio: ["pipe", "pipe", "pipe"] });

    sshCmd.stdin?.write(content);
    sshCmd.stdin?.end();

    sshCmd.on("close", (code) => {
      resolve(code === 0);
    });
    sshCmd.on("error", () => resolve(false));
  });
};

export const removeRemoteCaddyRoute = (
  server: Server | { host: string; port?: number; sshUser?: string | null },
  filename: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    const user = server.sshUser || "root";
    const port = server.port || 22;
    const sshCmd = spawn("ssh", [
      "-p", String(port),
      "-o", "StrictHostKeyChecking=no",
      `${user}@${server.host}`,
      `rm -f /etc/caddy/routes/${filename} && (caddy reload --config /etc/caddy/Caddyfile || docker exec dequel-caddy caddy reload || true)`
    ], { stdio: ["ignore", "pipe", "pipe"] });
    sshCmd.on("close", (code) => resolve(code === 0));
    sshCmd.on("error", () => resolve(false));
  });
};

export const execRemoteCommand = (
  server: Server | { host: string; port?: number; sshUser?: string | null },
  command: string,
  options: { env?: Record<string, string>; onLog?: (line: string) => Promise<void> | void; signal?: AbortSignal } = {}
): Promise<{ code: number; stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    const user = server.sshUser || "root";
    const port = server.port || 22;
    const child = spawn("ssh", [
      "-p", String(port),
      "-o", "StrictHostKeyChecking=no",
      "-o", "ConnectTimeout=30",
      `${user}@${server.host}`,
      command,
    ], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...options.env } });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      if (options.onLog) {
        text.split("\n").filter(Boolean).forEach((line) => options.onLog!(line));
      }
    });
    child.stderr?.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      if (options.onLog) {
        text.split("\n").filter(Boolean).forEach((line) => options.onLog!(line));
      }
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim() }));
    child.on("error", (err) => reject(err));
    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        child.kill("SIGTERM");
        reject(new Error("Remote SSH command aborted"));
      });
    }
  });
};

export const runRemoteScript = (
  server: Server | { host: string; port?: number; sshUser?: string | null },
  script: string,
  options: { onLog?: (line: string) => Promise<void> | void; signal?: AbortSignal } = {}
): Promise<{ code: number; stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    const user = server.sshUser || "root";
    const port = server.port || 22;
    const child = spawn("ssh", [
      "-p", String(port),
      "-o", "StrictHostKeyChecking=no",
      "-o", "ConnectTimeout=30",
      `${user}@${server.host}`,
      "bash -s",
    ], { stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      if (options.onLog) {
        text.split("\n").filter(Boolean).forEach((line) => options.onLog!(line));
      }
    });
    child.stderr?.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      if (options.onLog) {
        text.split("\n").filter(Boolean).forEach((line) => options.onLog!(line));
      }
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim() }));
    child.on("error", (err) => reject(err));
    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        child.kill("SIGTERM");
        reject(new Error("Remote build script aborted"));
      });
    }
    child.stdin.write(script);
    child.stdin.end();
  });
};
