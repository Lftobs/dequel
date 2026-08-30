import { spawn } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { config } from "./config";

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

const execWgCommand = (args: string[]): Promise<boolean> => {
  if (!config.wireguardServerContainer) return Promise.resolve(false);
  return new Promise((resolve) => {
    const child = spawn("docker", ["exec", config.wireguardServerContainer!, "wg", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.on("close", (code) => {
      if (code !== 0) console.warn(`[WireGuard] wg ${args[0]} failed: ${stderr.trim()}`);
      resolve(code === 0);
    });
    child.on("error", () => resolve(false));
  });
};

export const provisionWireGuardPeer = async (peerIp: string, publicKey: string): Promise<boolean> => {
  if (!config.wireguardServerPublicKey || !publicKey || !peerIp) return false;
  return execWgCommand(["set", "wg0", "peer", publicKey, "allowed-ips", `${peerIp}/32`]);
};

export const removeWireGuardPeer = async (publicKey: string): Promise<boolean> => {
  if (!publicKey) return false;
  return execWgCommand(["set", "wg0", "peer", publicKey, "remove"]);
};