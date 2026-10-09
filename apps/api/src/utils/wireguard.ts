import { generateKeyPairSync } from "node:crypto";
import { config } from "./config";
import { safeSpawn } from "./process-exec";

export interface WireGuardPeerConfig {
	peerIp: string;
	privateKey: string;
	serverPublicKey: string;
	serverEndpoint: string;
	allowedIps: string;
}

export interface WireGuardKeyPair {
	privateKey: string;
	publicKey: string;
}

const base64urlToBase64 = (value: string) => Buffer.from(value, "base64url").toString("base64");

export const generateWireGuardKeyPair = (): WireGuardKeyPair => {
	const { privateKey, publicKey } = generateKeyPairSync("x25519");
	const privJwk = privateKey.export({ format: "jwk" }) as { d: string };
	const pubJwk = publicKey.export({ format: "jwk" }) as { x: string };
	return {
		privateKey: base64urlToBase64(privJwk.d),
		publicKey: base64urlToBase64(pubJwk.x),
	};
};

export const buildWireGuardPeerConfig = (
	peerIp: string,
	privateKey: string,
	serverPublicKey: string,
	serverEndpoint: string,
): WireGuardPeerConfig | null => {
	if (!serverPublicKey || !serverEndpoint) return null;
	return {
		peerIp,
		privateKey,
		serverPublicKey,
		serverEndpoint,
		allowedIps: `${config.wireguardPeerCidr}`,
	};
};

const execWgCommand = async (args: string[]): Promise<boolean> => {
	if (!config.wireguardServerContainer) return false;
	try {
		const res = await safeSpawn("docker", ["exec", config.wireguardServerContainer, "wg", ...args], {
			timeoutMs: 15_000,
		});
		if (res.code !== 0) {
			console.warn(`[WireGuard] wg ${args[0]} failed: ${res.stderr.trim()}`);
			return false;
		}
		return true;
	} catch {
		return false;
	}
};

export const provisionWireGuardPeer = async (peerIp: string, publicKey: string): Promise<boolean> => {
	if (!config.wireguardServerPublicKey || !publicKey || !peerIp) return false;
	return execWgCommand(["set", "wg0", "peer", publicKey, "allowed-ips", `${peerIp}/32`]);
};

export const removeWireGuardPeer = async (publicKey: string): Promise<boolean> => {
	if (!publicKey) return false;
	return execWgCommand(["set", "wg0", "peer", publicKey, "remove"]);
};
