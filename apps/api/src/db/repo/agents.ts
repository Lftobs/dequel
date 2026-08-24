import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { agentCredentials, agentRegistrationTokens, servers } from "../schema";
import { getDb } from "../db-provider";
import { hashToken } from "../../utils/auth";
import { now, getRowsAffected } from "./helpers";
import { config } from "../../utils/config";
import { buildWireGuardPeerConfig, generateWireGuardKeyPair } from "../../utils/wireguard";
import type { AgentCapabilities } from "../../agents/protocol";

export const createAgentRegistrationToken = async (serverName: string, labels: Record<string, string> = {}) => {
  const rawToken = `dqr_${randomBytes(32).toString("hex")}`;
  const createdAt = now();
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  const db = await getDb();
  await db.insert(agentRegistrationTokens).values({
    id: randomUUID(),
    tokenHash: hashToken(rawToken),
    serverName,
    labels,
    expiresAt,
    createdAt,
  }).execute();
  return { token: rawToken, expiresAt };
};

const allocatePeerIp = async (): Promise<string> => {
  const db = await getDb();
  const rows = await db.select({ peerIp: servers.peerIp }).from(servers)
    .where(and(eq(servers.mode, "agent"), isNull(servers.revokedAt))).execute();
  const used = new Set(rows.map((row) => Number(row.peerIp?.split(".").pop() || 0)));
  for (let i = 2; i <= 254; i++) {
    if (!used.has(i)) return `10.200.0.${i}`;
  }
  throw new Error("No WireGuard peer IPs available");
};

export const exchangeAgentRegistrationToken = async (
  rawToken: string,
  agentVersion: string,
  capabilities: AgentCapabilities,
  publicHost?: string,
) => {
  const db = await getDb();
  const timestamp = now();
  const [registration] = await db.select().from(agentRegistrationTokens).where(and(
    eq(agentRegistrationTokens.tokenHash, hashToken(rawToken)),
    isNull(agentRegistrationTokens.usedAt),
    gt(agentRegistrationTokens.expiresAt, timestamp),
  )).execute();
  if (!registration) return null;
  const consumed = await db.update(agentRegistrationTokens).set({ usedAt: timestamp }).where(and(
    eq(agentRegistrationTokens.id, registration.id),
    isNull(agentRegistrationTokens.usedAt),
  )).execute();
  if (getRowsAffected(consumed) !== 1) return null;

  const serverId = randomUUID();
  const agentId = randomUUID();
  const rawCredential = `dqa_${randomBytes(32).toString("hex")}`;
  const keyPair = generateWireGuardKeyPair();
  const peerIp = await allocatePeerIp();
  const wireguard = buildWireGuardPeerConfig(
    peerIp,
    keyPair.privateKey,
    config.wireguardServerPublicKey,
    config.wireguardServerEndpoint,
  );
  await db.insert(servers).values({
    id: serverId,
    name: registration.serverName,
    host: publicHost || "agent",
    port: 0,
    authToken: "",
    mode: "agent",
    agentId,
    agentVersion,
    peerIp,
    capabilities,
    labels: { ...parseLabels(registration.labels), wgPublicKey: keyPair.publicKey },
    status: "pending",
    registeredAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).execute();
  await db.insert(agentCredentials).values({
    id: randomUUID(),
    serverId,
    credentialHash: hashToken(rawCredential),
    createdAt: timestamp,
  }).execute();
  return { serverId, agentId, credential: rawCredential, wireguard, peerIp };
};

const parseLabels = (value: unknown): Record<string, string> => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, string>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const validateAgentCredential = async (rawCredential: string) => {
  const db = await getDb();
  const [row] = await db.select().from(agentCredentials).where(and(
    eq(agentCredentials.credentialHash, hashToken(rawCredential)),
    isNull(agentCredentials.revokedAt),
  )).execute();
  if (!row) return null;
  await db.update(agentCredentials).set({ lastUsedAt: now() }).where(eq(agentCredentials.id, row.id)).execute();
  return row.serverId;
};

export const updateAgentHeartbeat = async (
  serverId: string,
  patch: { agentVersion?: string; capabilities?: AgentCapabilities; cpuUsedPercent?: number; memoryUsedMb?: number },
) => {
  const timestamp = now();
  const updates: Record<string, unknown> = { status: "connected", lastHeartbeat: timestamp, updatedAt: timestamp };
  if (patch.agentVersion !== undefined) updates.agentVersion = patch.agentVersion;
  if (patch.capabilities !== undefined) updates.capabilities = patch.capabilities;
  if (patch.cpuUsedPercent !== undefined) updates.cpuUsedPercent = patch.cpuUsedPercent;
  if (patch.memoryUsedMb !== undefined) updates.memoryUsedMb = patch.memoryUsedMb;
  const db = await getDb();
  await db.update(servers).set(updates).where(eq(servers.id, serverId)).execute();
};
