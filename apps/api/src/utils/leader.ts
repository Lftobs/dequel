import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { config } from "./config";

const LEADER_KEY = "dequel:leader";
const LEADER_TTL_MS = 10_000;
const RENEW_INTERVAL_MS = 3_000;

const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

const createClient = () =>
  new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  });

export class LeaderElection {
  private redis: Redis | null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private token: string | null = null;
  private leadership = false;
  private stopped = false;

  constructor(redis?: Redis) {
    this.redis = redis ?? null;
  }

  private client() {
    if (!this.redis) {
      this.redis = createClient();
    }
    return this.redis;
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
    await this.client().quit().catch(() => {});
  }

  async release() {
    if (!this.token) return;
    const token = this.token;
    this.token = null;
    this.leadership = false;
    await this.client()
      .eval(RELEASE_SCRIPT, 1, LEADER_KEY, token)
      .catch(() => {});
  }

  get isLeader() {
    return this.leadership;
  }

  private async acquire() {
    if (this.stopped) return;
    try {
      if (this.token) {
        const renewed = await this.client().pexpire(LEADER_KEY, LEADER_TTL_MS);
        this.leadership = renewed === 1;
        if (!this.leadership) this.token = null;
        return;
      }
      const token = randomUUID();
      const acquired = await this.client().set(LEADER_KEY, token, "PX", LEADER_TTL_MS, "NX");
      this.leadership = acquired === "OK";
      if (this.leadership) {
        this.token = token;
      }
    } catch {
      this.leadership = false;
      this.token = null;
    }
  }
}

export const leader = new LeaderElection();
