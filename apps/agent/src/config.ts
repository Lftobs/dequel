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
	controlPlaneUrl: process.env.DEQUL_CONTROL_PLANE?.replace(/\/+$/, "") || "",
	tunnelUrl: process.env.DEQUL_AGENT_TUNNEL_URL?.replace(/\/+$/, "") || "",
	registrationToken: process.env.DEQUL_REGISTRATION_TOKEN,
	credentialPath: process.env.DEQUL_AGENT_CREDENTIAL_PATH || join(homedir(), ".dequl", "agent.json"),
	agentVersion: process.env.DEQUL_AGENT_VERSION || "0.2.1",
	publicHost: process.env.DEQUL_AGENT_PUBLIC_HOST,
	workspaceRoot: process.env.DEQUL_AGENT_WORKSPACE || "/var/lib/dequl/workspace",
	caddyRoutesDir: process.env.DEQUL_AGENT_CADDY_ROUTES || "/etc/dequl/caddy/routes",
	dockerNetwork: process.env.DEQUL_DOCKER_NETWORK || "dequl_net",
};

export const requireControlPlaneUrl = () => {
	if (!config.controlPlaneUrl) throw new Error("DEQUL_CONTROL_PLANE is required");
	return config.controlPlaneUrl;
};
