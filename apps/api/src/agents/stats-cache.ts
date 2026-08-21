import Redis from "ioredis";
import { config } from "../utils/config";
import type { AgentContainerStat } from "./protocol";

const STATS_TTL_SECONDS = 120;

export type CachedContainerStat = AgentContainerStat;

class AgentStatsCache {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null, enableOfflineQueue: false });
  }

  private key(serverId: string) {
    return `dequel:agent-stats:${serverId}`;
  }

  async set(serverId: string, containers: AgentContainerStat[]) {
    if (!containers || containers.length === 0) return;
    const payload = JSON.stringify({ updatedAt: new Date().toISOString(), containers });
    await this.redis.set(this.key(serverId), payload, "EX", STATS_TTL_SECONDS).catch(() => {});
  }

  async get(serverId: string): Promise<Map<string, CachedContainerStat>> {
    const raw = await this.redis.get(this.key(serverId)).catch(() => null);
    const result = new Map<string, CachedContainerStat>();
    if (!raw) return result;
    try {
      const parsed = JSON.parse(raw) as { containers?: AgentContainerStat[] };
      for (const container of parsed.containers ?? []) {
        result.set(container.containerName, container);
      }
    } catch {
      return result;
    }
    return result;
  }

  async getAll(): Promise<Map<string, Map<string, CachedContainerStat>>> {
    const keys = await this.redis.keys("dequel:agent-stats:*").catch(() => [] as string[]);
    const result = new Map<string, Map<string, CachedContainerStat>>();
    for (const key of keys) {
      const serverId = key.slice("dequel:agent-stats:".length);
      result.set(serverId, await this.get(serverId));
    }
    return result;
  }
}

export const agentStatsCache = new AgentStatsCache();