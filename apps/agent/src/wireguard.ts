import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import type { WireGuardPeerConfig } from "./config";

const run = (command: string, args: string[]) =>
	new Promise<{ code: number; output: string }>((resolve) => {
		const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
		let output = "";
		child.stdout.on("data", (chunk) => {
			output += String(chunk);
		});
		child.stderr.on("data", (chunk) => {
			output += String(chunk);
		});
		child.on("close", (code) => resolve({ code: code ?? 1, output: output.trim() }));
		child.on("error", () => resolve({ code: 127, output: `${command} not found` }));
	});

export const bringUpTunnel = async (config: WireGuardPeerConfig): Promise<boolean> => {
	const confPath = "/etc/wireguard/dequel0.conf";
	const contents = [
		"[Interface]",
		`PrivateKey = ${config.privateKey}`,
		`Address = ${config.peerIp}/24`,
		"",
		"[Peer]",
		`PublicKey = ${config.serverPublicKey}`,
		`Endpoint = ${config.serverEndpoint}`,
		`AllowedIPs = ${config.allowedIps}`,
		"PersistentKeepalive = 25",
		"",
	].join("\n");
	try {
		await mkdir("/etc/wireguard", { recursive: true });
		await writeFile(confPath, contents, { mode: 0o600 });
		const up = await run("wg-quick", ["up", "dequel0"]);
		if (up.code !== 0) {
			const down = await run("wg-quick", ["down", "dequel0"]);
			if (down.code !== 0) {
				console.warn(`[WireGuard] Could not bring up tunnel: ${up.output}`);
				return false;
			}
			const retry = await run("wg-quick", ["up", "dequel0"]);
			if (retry.code !== 0) {
				console.warn(`[WireGuard] Could not bring up tunnel: ${retry.output}`);
				return false;
			}
			console.log(`[WireGuard] Tunnel up at ${config.peerIp}`);
			return true;
		}
		console.log(`[WireGuard] Tunnel up at ${config.peerIp}`);
		return true;
	} catch (error) {
		console.warn("[WireGuard] Tunnel setup skipped:", error instanceof Error ? error.message : String(error));
		return false;
	}
};
