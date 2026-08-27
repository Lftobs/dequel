import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Server } from "../types";

export interface SshExecutionOptions {
  env?: Record<string, string>;
  onLog?: (line: string) => Promise<void> | void;
  signal?: AbortSignal;
}

const SSH_KEYS_DIR = join(tmpdir(), "dequel_ssh_keys");

export const ensureSshKey = (server: { host: string; port?: number; sshUser?: string | null; sshKey?: string | null; id?: string }): string | null => {
  if (!server.sshKey) return null;
  if (!existsSync(SSH_KEYS_DIR)) {
    mkdirSync(SSH_KEYS_DIR, { recursive: true, mode: 0o700 });
  }
  const keyIdentifier = (server.id || server.host).replace(/[^a-zA-Z0-9_-]/g, "_");
  const keyPath = join(SSH_KEYS_DIR, `id_${keyIdentifier}`);
  writeFileSync(keyPath, server.sshKey.trim() + "\n", { mode: 0o600 });

  const homeDir = process.env.HOME || "/root";
  const sshDir = join(homeDir, ".ssh");
  if (!existsSync(sshDir)) {
    mkdirSync(sshDir, { recursive: true, mode: 0o700 });
  }
  const configPath = join(sshDir, "config");
  const hostEntry = `\nHost ${server.host}\n  IdentityFile ${keyPath}\n  StrictHostKeyChecking no\n  IdentitiesOnly yes\n`;
  let currentConfig = "";
  if (existsSync(configPath)) {
    currentConfig = new TextDecoder().decode(Bun.spawnSync(["cat", configPath]).stdout);
  }
  if (!currentConfig.includes(`Host ${server.host}`)) {
    writeFileSync(configPath, currentConfig + hostEntry, { mode: 0o600 });
  }

  return keyPath;
};

export const getDockerSshTarget = (server: Server | { host: string; port?: number; sshUser?: string | null; sshKey?: string | null; id?: string }): string => {
  ensureSshKey(server);
  const user = server.sshUser || "root";
  const port = server.port || 22;
  return `ssh://${user}@${server.host}:${port}`;
};

export const testSshConnection = (server: { host: string; port?: number; sshUser?: string | null; sshKey?: string | null; id?: string }): Promise<boolean> => {
  return new Promise((resolve) => {
    const target = getDockerSshTarget(server);
    const child = spawn("docker", ["-H", target, "info", "--format", "{{.ServerVersion}}"], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
    });
    let output = "";
    child.stdout?.on("data", (chunk) => { output += String(chunk); });
    child.on("close", (code) => {
      resolve(code === 0 && output.trim().length > 0);
    });
    child.on("error", () => resolve(false));
    child.on("timeout", () => { child.kill(); resolve(false); });
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
    if (!/^[a-zA-Z0-9._-]+$/.test(filename) || filename.includes('..')) {
      resolve(false);
      return;
    }
    const keyPath = ensureSshKey(server);
    const keyArgs = keyPath ? ["-i", keyPath, "-o", "IdentitiesOnly=yes"] : [];
    const user = server.sshUser || "root";
    const port = server.port || 22;
    const sshCmd = spawn("ssh", [
      "-p", String(port),
      "-o", "StrictHostKeyChecking=no",
      "-o", "ConnectTimeout=10",
      ...keyArgs,
      `${user}@${server.host}`,
      `sudo mkdir -p /etc/caddy/routes && sudo tee /etc/caddy/routes/${filename} > /dev/null && (sudo systemctl reload caddy || sudo caddy reload --config /etc/caddy/Caddyfile || docker exec dequel-caddy caddy reload || true)`
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
  server: Server | { host: string; port?: number; sshUser?: string | null; sshKey?: string | null; id?: string },
  filename: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!/^[a-zA-Z0-9._-]+$/.test(filename) || filename.includes('..')) {
      resolve(false);
      return;
    }
    const keyPath = ensureSshKey(server);
    const keyArgs = keyPath ? ["-i", keyPath, "-o", "IdentitiesOnly=yes"] : [];
    const user = server.sshUser || "root";
    const port = server.port || 22;
    const sshCmd = spawn("ssh", [
      "-p", String(port),
      "-o", "StrictHostKeyChecking=no",
      "-o", "ConnectTimeout=10",
      ...keyArgs,
      `${user}@${server.host}`,
      `sudo rm -f /etc/caddy/routes/${filename} && (sudo systemctl reload caddy || sudo caddy reload --config /etc/caddy/Caddyfile || docker exec dequel-caddy caddy reload || true)`
    ], { stdio: ["ignore", "pipe", "pipe"] });
    sshCmd.on("close", (code) => resolve(code === 0));
    sshCmd.on("error", () => resolve(false));
  });
};

export const execRemoteCommand = (
  server: Server | { host: string; port?: number; sshUser?: string | null; sshKey?: string | null; id?: string },
  command: string,
  options: { env?: Record<string, string>; onLog?: (line: string) => Promise<void> | void; signal?: AbortSignal } = {}
): Promise<{ code: number; stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    const keyPath = ensureSshKey(server);
    const keyArgs = keyPath ? ["-i", keyPath, "-o", "IdentitiesOnly=yes"] : [];
    const user = server.sshUser || "root";
    const port = server.port || 22;
    const child = spawn("ssh", [
      "-p", String(port),
      "-o", "StrictHostKeyChecking=no",
      "-o", "ConnectTimeout=30",
      ...keyArgs,
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
  server: Server | { host: string; port?: number; sshUser?: string | null; sshKey?: string | null; id?: string },
  script: string,
  options: { onLog?: (line: string) => Promise<void> | void; signal?: AbortSignal } = {}
): Promise<{ code: number; stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    const keyPath = ensureSshKey(server);
    const keyArgs = keyPath ? ["-i", keyPath, "-o", "IdentitiesOnly=yes"] : [];
    const user = server.sshUser || "root";
    const port = server.port || 22;
    const child = spawn("ssh", [
      "-p", String(port),
      "-o", "StrictHostKeyChecking=no",
      "-o", "ConnectTimeout=30",
      ...keyArgs,
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
