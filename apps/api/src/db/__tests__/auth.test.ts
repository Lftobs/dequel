import { describe, it, expect, mock, beforeAll, beforeEach, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';

const TEST_SECRET = 'test-jwt-secret-for-testing-purposes-only';

let db: Database;

const fileUrl = (path: string) => new URL(path, import.meta.url).toString();
mock.module(fileUrl('../client.ts'), () => ({
  getDb: () => db,
}));

beforeAll(async () => {
  db = new Database(':memory:');
  db.run(`
    CREATE TABLE refresh_tokens (
      id text PRIMARY KEY NOT NULL,
      username text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expires_at text NOT NULL,
      created_at text NOT NULL,
      blacklisted_at text
    )
  `);
  const { initAuth } = await import('../../utils/auth');
  initAuth(TEST_SECRET);
});

beforeEach(() => {
  db.run('DELETE FROM refresh_tokens');
});

afterAll(() => {
  db.close();
});

describe('storeRefreshToken / validateRefreshToken', () => {
  it('stores and validates a refresh token', async () => {
    const { generateRefreshToken, storeRefreshToken, validateRefreshToken } = await import('../../utils/auth');
    const token = generateRefreshToken();
    await storeRefreshToken('testuser', token);
    const username = await validateRefreshToken(token);
    expect(username).toBe('testuser');
  });

  it('returns null for unknown token', async () => {
    const { validateRefreshToken } = await import('../../utils/auth');
    const result = await validateRefreshToken('dqr_nonexistent');
    expect(result).toBeNull();
  });
});

describe('blacklistRefreshToken', () => {
  it('blacklists a refresh token', async () => {
    const { generateRefreshToken, storeRefreshToken, validateRefreshToken, blacklistRefreshToken } = await import('../../utils/auth');
    const token = generateRefreshToken();
    await storeRefreshToken('testuser', token);
    expect(await validateRefreshToken(token)).toBe('testuser');
    await blacklistRefreshToken(token);
    expect(await validateRefreshToken(token)).toBeNull();
  });

  it('does not affect other tokens when blacklisting one', async () => {
    const { generateRefreshToken, storeRefreshToken, validateRefreshToken, blacklistRefreshToken } = await import('../../utils/auth');
    const tokenA = generateRefreshToken();
    const tokenB = generateRefreshToken();
    await storeRefreshToken('user1', tokenA);
    await storeRefreshToken('user2', tokenB);
    await blacklistRefreshToken(tokenA);
    expect(await validateRefreshToken(tokenA)).toBeNull();
    expect(await validateRefreshToken(tokenB)).toBe('user2');
  });
});

describe('cleanupExpiredTokens', () => {
  it('removes expired tokens', async () => {
    const { generateRefreshToken, storeRefreshToken, cleanupExpiredTokens } = await import('../../utils/auth');
    const token = generateRefreshToken();
    await storeRefreshToken('testuser', token);
    const row = db.query('SELECT token_hash FROM refresh_tokens ORDER BY created_at DESC LIMIT 1').get() as { token_hash: string };
    db.run(`UPDATE refresh_tokens SET expires_at = '2000-01-01T00:00:00.000Z' WHERE token_hash = ?`, [row.token_hash]);
    await cleanupExpiredTokens();
    const remaining = db.query('SELECT COUNT(*) as c FROM refresh_tokens').get() as { c: number };
    expect(remaining.c).toBe(0);
  });

  it('keeps non-expired tokens', async () => {
    const { generateRefreshToken, storeRefreshToken, cleanupExpiredTokens } = await import('../../utils/auth');
    const token = generateRefreshToken();
    await storeRefreshToken('testuser', token);
    await cleanupExpiredTokens();
    const remaining = db.query('SELECT COUNT(*) as c FROM refresh_tokens').get() as { c: number };
    expect(remaining.c).toBe(1);
  });
});
