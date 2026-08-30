import { homedir } from "node:os";
import { join } from "node:path";

export interface WireGuardPeerConfig {
  peerIp: string;
  privateKey: string;
  serverPublicKey: string;
  serverEndpoint: string;
  allowedIps: string;
}

export const config = {
  controlPlaneUrl: process.env.DEQUEL_CONTROL_PLANE?.replace(/\/+$/, "") || "",
  tunnelUrl: process.env.DEQUEL_AGENT_TUNNEL_URL?.replace(/\/+$/, "") || "",
  registrationToken: process.env.DEQUEL_REGISTRATION_TOKEN,
  credentialPath: process.env.DEQUEL_AGENT_CREDENTIAL_PATH || join(homedir(), ".dequel", "agent.json"),
  agentVersion: process.env.DEQUEL_AGENT_VERSION || "0.2.1",
  publicHost: process.env.DEQUEL_AGENT_PUBLIC_HOST,
  workspaceRoot: process.env.DEQUEL_AGENT_WORKSPACE || "/var/lib/dequel/workspace",
  dockerNetwork: process.env.DEQUEL_DOCKER_NETWORK || "dequel_net",
};

export const requireControlPlaneUrl = () => {
  if (!config.controlPlaneUrl) throw new Error("DEQUEL_CONTROL_PLANE is required");
  return config.controlPlaneUrl;
};