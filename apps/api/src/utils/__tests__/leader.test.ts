import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { LeaderElection } from '../leader';

const leaderKey = 'dequel:leader';

class FakeRedis {
  key: string | null = null;
  value: string | null = null;
  expiresAt = 0;
  now = 0;
  set = mock(async (_key: string, value: string, _px: string, ttl: number, _nx: string) => {
    if (this.key !== null && this.now < this.expiresAt) return null;
    this.key = value;
    this.value = value;
    this.expiresAt = this.now + ttl;
    return 'OK';
  });
  pexpire = mock(async (_key: string, ttl: number) => {
    if (this.key === null || this.now >= this.expiresAt) return 0;
    this.expiresAt = this.now + ttl;
    return 1;
  });
  eval = mock(async (script: string, _n: number, key: string, token: string) => {
    if (this.value === token) {
      this.key = null;
      this.value = null;
      return 1;
    }
    return 0;
  });
  quit = mock(async () => {});
}

describe('LeaderElection', () => {
  let fake: FakeRedis;
  let election: LeaderElection;

  beforeEach(() => {
    fake = new FakeRedis();
    election = new LeaderElection(fake as any);
  });

  afterEach(async () => {
    await election.stop();
  });

  it('acquires leadership when the key is free', async () => {
    await election.start();
    expect(election.isLeader).toBe(true);
    expect(fake.set).toHaveBeenCalledWith(leaderKey, expect.any(String), 'PX', 10000, 'NX');
  });

  it('fails to acquire when another instance holds the lock', async () => {
    fake.key = 'other-token';
    fake.value = 'other-token';
    fake.expiresAt = fake.now + 10000;
    await election.start();
    expect(election.isLeader).toBe(false);
  });

  it('renews its own lease and keeps leadership', async () => {
    await election.start();
    expect(election.isLeader).toBe(true);
    await election['acquire']();
    expect(election.isLeader).toBe(true);
    expect(fake.pexpire).toHaveBeenCalledWith(leaderKey, 10000);
  });

  it('re-acquires after losing the lease', async () => {
    await election.start();
    expect(election.isLeader).toBe(true);
    fake.expiresAt = 0;
    fake.now = 100_000;
    await election['acquire']();
    expect(election.isLeader).toBe(false);
    await election['acquire']();
    expect(election.isLeader).toBe(true);
  });

  it('only deletes the key it holds on release', async () => {
    await election.start();
    const token = election['token'];
    fake.key = 'replaced-token';
    fake.value = 'replaced-token';
    fake.expiresAt = fake.now + 10000;
    await election.release();
    expect(fake.eval).toHaveBeenCalledWith(expect.stringContaining('del'), 1, leaderKey, token);
    expect(fake.key).toBe('replaced-token');
    expect(election.isLeader).toBe(false);
  });
});
