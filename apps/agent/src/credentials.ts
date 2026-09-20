import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { config, requireControlPlaneUrl, type WireGuardPeerConfig } from "./config";
import type { AgentCapabilities } from "./protocol";

type StoredCredential = {
	serverId: string;
	agentId: string;
	credential: string;
	wireguard: WireGuardPeerConfig | null;
};

export const loadCredential = async (): Promise<StoredCredential | null> => {
	try {
		return JSON.parse(await readFile(config.credentialPath, "utf8"));
	} catch {
		return null;
	}
};

export const registerAgent = async (capabilities: AgentCapabilities): Promise<StoredCredential> => {
	if (!config.registrationToken) throw new Error("No stored credential and DEQUEL_REGISTRATION_TOKEN is not set");
	const response = await fetch(`${requireControlPlaneUrl()}/api/agents/register`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			token: config.registrationToken,
			agentVersion: config.agentVersion,
			capabilities,
			publicHost: config.publicHost,
		}),
	});
	if (!response.ok) {
		const body = (await response.json().catch(() => ({ error: response.statusText }))) as { error?: string };
		throw new Error(body.error || "Agent registration failed");
	}
	const registration = (await response.json()) as StoredCredential;
	const stored: StoredCredential = {
		serverId: registration.serverId,
		agentId: registration.agentId,
		credential: registration.credential,
		wireguard: registration.wireguard ?? null,
	};
	await mkdir(dirname(config.credentialPath), { recursive: true, mode: 0o700 });
	await writeFile(config.credentialPath, JSON.stringify(stored), { mode: 0o600 });
	await chmod(config.credentialPath, 0o600);
	return stored;
};
