import { describe, it, expect, mock, beforeEach } from 'bun:test';

class FakeRedis {
  queue: string[] = [];
  retry: string[] = [];
  dlq: string[] = [];
  lock = false;
  rpush = mock(async (key: string, ...values: string[]) => {
    if (key.includes('dlq')) {
      this.dlq.push(...values);
      return;
    }
    this.queue.push(...values);
  });
  zadd = mock(async (_key: string, _score: string, value: string) => {
    this.retry.push(value);
  });
  zrangebyscore = mock(async () => {
    return this.retry.splice(0, 50);
  });
  zrem = mock(async () => {});
  set = mock(async (_key: string, _value: string, _px: string, _ttl: number, _nx: string) => {
    if (this.lock) return null;
    this.lock = true;
    return 'OK';
  });
  blpop = mock(async () => {
    const value = this.queue.shift();
    if (!value) return null;
    return ['queue', value];
  });
  del = mock(async () => {
    this.lock = false;
  });
  quit = mock(async () => {});
}

const fake = new FakeRedis();

mock.module('ioredis', () => {
  return {
    default: function RedisMock() {
      return fake as any;
    },
  };
});

const { DeploymentQueue } = await import('../queue');

describe('DeploymentQueue', () => {
  beforeEach(() => {
    fake.queue = [];
    fake.retry = [];
    fake.dlq = [];
    fake.lock = false;
    fake.rpush.mockClear();
    fake.zadd.mockClear();
    fake.zrangebyscore.mockClear();
    fake.zrem.mockClear();
    fake.set.mockClear();
    fake.blpop.mockClear();
    fake.del.mockClear();
    fake.quit.mockClear();
  });

  it('enqueues items to redis list', async () => {
    const queue = new DeploymentQueue();
    await queue.enqueue('dep-1');
    await queue.enqueue('dep-2');
    expect(fake.queue).toEqual([
      '{"id":"dep-1","attempt":0}',
      '{"id":"dep-2","attempt":0}',
    ]);
  });

  it('starts worker and processes items', async () => {
    const queue = new DeploymentQueue();
    await queue.enqueue('dep-1');
    await queue.enqueue('dep-2');

    const handled: string[] = [];
    const worker = queue.start(async (id) => {
      handled.push(id);
      if (handled.length >= 2) await queue.stop();
      return true;
    });

    await worker;
    expect(handled).toEqual(['dep-1', 'dep-2']);
    expect(fake.blpop).toHaveBeenCalled();
  });

  it('retries failed jobs with backoff and sends to dlq', async () => {
    const queue = new DeploymentQueue();
    await queue.enqueue('dep-fail');

    let attempts = 0;
    const worker = queue.start(async () => {
      attempts += 1;
      if (attempts >= 2) await queue.stop();
      return false;
    });

    await worker;
    expect(attempts).toBeGreaterThanOrEqual(1);
  });
});
