import Redis from "ioredis";
import { config } from "./config";

const LEADER_KEY = "dequel:leader";
const LEADER_TTL_MS = 10_000;
const RENEW_INTERVAL_MS = 3_000;

class LeaderElection {
  private redis: Redis;
  private timer: ReturnType<typeof setInterval> | null = null;
  private leadership = false;
  private stopped = false;

  constructor() {
    this.redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
    });
  }

  async start() {
    if (this.timer) return;
    await this.acquire();
    this.timer = setInterval(() => {
      void this.acquire();
    }, RENEW_INTERVAL_MS);
  }

  async stop() {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.release();
    await this.redis.quit().catch(() => {});
  }

  async release() {
    await this.redis.del(LEADER_KEY).catch(() => {});
    this.leadership = false;
  }

  get isLeader() {
    return this.leadership;
  }

  private async acquire() {
    if (this.stopped) return;
    try {
      const acquired = await this.redis.set(LEADER_KEY, "1", "PX", LEADER_TTL_MS, "NX");
      this.leadership = acquired === "OK";
      if (this.leadership) {
        await this.redis.pexpire(LEADER_KEY, LEADER_TTL_MS).catch(() => {});
      }
    } catch {
      this.leadership = false;
    }
  }
}

export const leader = new LeaderElection();
