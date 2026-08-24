import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createTestPool, truncateAllTables } from '../test-helper';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../schema';
import { setDbProvider } from '../db-provider';

const TEST_SECRET = 'test-jwt-secret-for-testing-purposes-only';
let pool: Pool;

beforeAll(async () => {
  pool = createTestPool();
  const db = drizzle(pool, { schema });
  setDbProvider(async () => db);
  const { initAuth } = await import('../../utils/auth');
  initAuth(TEST_SECRET);
});

beforeEach(async () => {
  await truncateAllTables(pool);
});

afterAll(async () => {
  await truncateAllTables(pool);
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
    const { refreshTokens } = await import('../../db/schema');
    const token = generateRefreshToken();
    await storeRefreshToken('testuser', token);
    const [row] = await pool.query(`SELECT token_hash FROM refresh_tokens ORDER BY created_at DESC LIMIT 1`).then(r => r.rows);
    await pool.query(`UPDATE refresh_tokens SET expires_at = '2000-01-01T00:00:00.000Z' WHERE token_hash = $1`, [row.token_hash]);
    await cleanupExpiredTokens();
    const remaining = await pool.query('SELECT COUNT(*) as c FROM refresh_tokens').then(r => r.rows[0]);
    expect(Number(remaining.c)).toBe(0);
  });

  it('keeps non-expired tokens', async () => {
    const { generateRefreshToken, storeRefreshToken, cleanupExpiredTokens } = await import('../../utils/auth');
    const token = generateRefreshToken();
    await storeRefreshToken('testuser', token);
    await cleanupExpiredTokens();
    const remaining = await pool.query('SELECT COUNT(*) as c FROM refresh_tokens').then(r => r.rows[0]);
    expect(Number(remaining.c)).toBe(1);
  });
});
