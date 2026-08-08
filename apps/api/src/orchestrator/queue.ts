import Redis from 'ioredis';
import { config } from '../utils/config';

const QUEUE_KEY = 'dequel:deploy:queue';
const RETRY_KEY = 'dequel:deploy:retry';
const DLQ_KEY = 'dequel:deploy:dlq';
const BLOCK_TIMEOUT_SEC = 5;

type JobPayload = {
  id: string;
  attempt: number;
};

const encodeJob = (job: JobPayload) => JSON.stringify(job);
const decodeJob = (raw: string): JobPayload | null => {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.id) return null;
    return { id: String(parsed.id), attempt: Number(parsed.attempt ?? 0) };
  } catch {
    return null;
  }
};

const createRedis = () => new Redis(config.redisUrl, { maxRetriesPerRequest: null });

export class DeploymentQueue {
  private redis: Redis;
  private shuttingDown = false;
  private workers: Promise<void>[] = [];

  constructor() {
    this.redis = createRedis();
  }

  async enqueue(deploymentId: string) {
    await this.redis.rpush(QUEUE_KEY, encodeJob({ id: deploymentId, attempt: 0 }));
  }

  async remove(deploymentId: string) {
    await this.redis.lrem(QUEUE_KEY, 0, encodeJob({ id: deploymentId, attempt: 0 }));
    await this.redis.zrem(RETRY_KEY, encodeJob({ id: deploymentId, attempt: 0 }));
    const allAttempts = Array.from({ length: config.queueRetryMax + 2 }, (_, i) =>
      encodeJob({ id: deploymentId, attempt: i }),
    );
    await this.redis.zrem(RETRY_KEY, ...allAttempts);
    for (let i = 0; i <= config.queueRetryMax + 1; i++) {
      await this.redis.lrem(DLQ_KEY, 0, encodeJob({ id: deploymentId, attempt: i }));
    }
  }

  async start(handler: (deploymentId: string) => Promise<boolean>) {
    this.workers = Array.from({ length: config.queueConcurrency }, (_, i) => this.runWorker(i, handler));
    await Promise.all(this.workers);
  }

  async stop() {
    this.shuttingDown = true;
    this.redis.quit().catch(() => {});
  }

  async drain() {
    await Promise.allSettled(this.workers);
  }

  private async runWorker(workerId: number, handler: (deploymentId: string) => Promise<boolean>) {
    const workerRedis = createRedis();
    try {
      while (!this.shuttingDown) {
        await this.requeueDueJobs(workerRedis);

        const item = await workerRedis.blpop(QUEUE_KEY, BLOCK_TIMEOUT_SEC);
        if (!item) continue;
        const job = decodeJob(item[1]);
        if (!job) continue;

        try {
          const ok = await handler(job.id);
          if (!ok) await this.retryOrDlq(job, workerRedis);
        } catch (err) {
          console.error(`[Queue] Worker ${workerId} handler error:`, err);
          await this.retryOrDlq(job, workerRedis);
        }
      }
    } finally {
      await workerRedis.quit();
    }
  }

  private async retryOrDlq(job: JobPayload, redis?: Redis) {
    const r = redis ?? this.redis;
    const attempt = job.attempt + 1;
    if (attempt > config.queueRetryMax) {
      await r.rpush(DLQ_KEY, encodeJob({ ...job, attempt }));
      return;
    }
    const delayMs = config.queueRetryBaseMs * Math.pow(2, attempt - 1);
    const runAt = Date.now() + delayMs;
    await r.zadd(RETRY_KEY, String(runAt), encodeJob({ ...job, attempt }));
  }

  private async requeueDueJobs(redis?: Redis) {
    const r = redis ?? this.redis;
    const now = Date.now();
    const jobs = await r.zrangebyscore(RETRY_KEY, 0, now, 'LIMIT', 0, 50);
    if (!jobs.length) return;
    await r.zrem(RETRY_KEY, ...jobs);
    await r.rpush(QUEUE_KEY, ...jobs);
  }
}
