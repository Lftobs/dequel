import Redis from 'ioredis';
import { config } from '../utils/config';
import { dockerBin } from '../utils/docker-bin';
import { tryRun } from './runtime';
import { DEQUEL_MANAGED_LABEL } from '../utils/dequel-labels';

const DLQ_KEY = 'dequel:deploy:dlq';
const GC_INTERVAL_MS = 1_800_000;

let interval: ReturnType<typeof setInterval> | null = null;
let redis: Redis | null = null;

const getRedis = () => {
  if (!redis) redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  return redis;
};

export const pruneDocker = async () => {
  await tryRun(dockerBin, ['container', 'prune', '-f', '--filter', `label=${DEQUEL_MANAGED_LABEL}`]);
  await tryRun(dockerBin, ['image', 'prune', '-f', '--filter', 'until=24h']);
  await tryRun(dockerBin, ['buildx', 'prune', '-f', '--filter', 'until=24h']);
};

export const pruneDlq = async () => {
  try {
    const r = getRedis();
    const size = await r.llen(DLQ_KEY);
    if (size > 0) {
      await r.del(DLQ_KEY);
      console.log(`[Cleanup] Purged ${size} items from dead letter queue`);
    }
  } catch (e) {
    console.warn('[Cleanup] DLQ prune failed:', e);
  }
};

export const startBuildCleanup = () => {
  if (interval) return;
  console.log('[Cleanup] Docker garbage collector started (every 30min)');
  interval = setInterval(async () => {
    await pruneDocker().catch(e => console.warn('[Cleanup] Docker prune failed:', e));
    await pruneDlq().catch(e => console.warn('[Cleanup] DLQ prune failed:', e));
  }, GC_INTERVAL_MS);
};

export const stopBuildCleanup = () => {
  if (interval) { clearInterval(interval); interval = null; }
  if (redis) { redis.quit(); redis = null; }
};
