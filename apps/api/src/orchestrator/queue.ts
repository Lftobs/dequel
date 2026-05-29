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

export class DeploymentQueue {
  private redis: Redis;
  private shuttingDown = false;

  constructor() {
    this.redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  }

  async enqueue(deploymentId: string) {
    await this.redis.rpush(QUEUE_KEY, encodeJob({ id: deploymentId, attempt: 0 }));
  }

  async start(handler: (deploymentId: string) => Promise<boolean>) {
    const workers = Array.from({ length: config.queueConcurrency }, (_, i) => this.runWorker(i, handler));
    await Promise.all(workers);
  }

  async stop() {
    this.shuttingDown = true;
    await this.redis.quit();
  }

  private async runWorker(workerId: number, handler: (deploymentId: string) => Promise<boolean>) {
    while (!this.shuttingDown) {
      await this.requeueDueJobs();

      const item = await this.redis.blpop(QUEUE_KEY, BLOCK_TIMEOUT_SEC);
      if (!item) continue;
      const job = decodeJob(item[1]);
      if (!job) continue;

      try {
        const ok = await handler(job.id);
        if (!ok) await this.retryOrDlq(job);
      } catch (err) {
        console.error(`[Queue] Worker ${workerId} handler error:`, err);
        await this.retryOrDlq(job);
      }
    }
  }

  private async retryOrDlq(job: JobPayload) {
    const attempt = job.attempt + 1;
    if (attempt > config.queueRetryMax) {
      await this.redis.rpush(DLQ_KEY, encodeJob({ ...job, attempt }));
      return;
    }
    const delayMs = config.queueRetryBaseMs * Math.pow(2, attempt - 1);
    const runAt = Date.now() + delayMs;
    await this.redis.zadd(RETRY_KEY, String(runAt), encodeJob({ ...job, attempt }));
  }

  private async requeueDueJobs() {
    const now = Date.now();
    const jobs = await this.redis.zrangebyscore(RETRY_KEY, 0, now, 'LIMIT', 0, 50);
    if (!jobs.length) return;
    await this.redis.zrem(RETRY_KEY, ...jobs);
    await this.redis.rpush(QUEUE_KEY, ...jobs);
  }
}
