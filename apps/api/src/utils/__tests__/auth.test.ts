import { describe, it, expect, mock, beforeAll, beforeEach, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';

const TEST_SECRET = 'test-jwt-secret-for-testing-purposes-only';

describe('JWT operations', () => {
  beforeAll(async () => {
    const { initAuth } = await import('../auth');
    initAuth(TEST_SECRET);
  });

  it('signs and verifies an access token', async () => {
    const { signAccessToken, verifyAccessToken } = await import('../auth');
    const token = await signAccessToken('testuser');
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
    const payload = await verifyAccessToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('testuser');
    expect(payload!.iat).toBeGreaterThan(0);
    expect(payload!.exp).toBe(payload!.iat + 900);
  });

  it('rejects a tampered token', async () => {
    const { signAccessToken, verifyAccessToken } = await import('../auth');
    const token = await signAccessToken('testuser');
    const parts = token.split('.');
    const tampered = ['bad', parts[1], parts[2]].join('.');
    expect(await verifyAccessToken(tampered)).toBeNull();
  });

  it('rejects token with wrong secret', async () => {
    const { signAccessToken, verifyAccessToken, initAuth } = await import('../auth');
    const token = await signAccessToken('testuser');
    initAuth('different-secret');
    const result = await verifyAccessToken(token);
    expect(result).toBeNull();
    initAuth(TEST_SECRET);
  });

  it('rejects malformed token', async () => {
    const { verifyAccessToken } = await import('../auth');
    expect(await verifyAccessToken('not-a-jwt')).toBeNull();
    expect(await verifyAccessToken('only.two.parts.here')).toBeNull();
    expect(await verifyAccessToken('')).toBeNull();
  });

  it('rejects expired token', async () => {
    const { verifyAccessToken } = await import('../auth');
    const parts = ['header', btoa(JSON.stringify({
      sub: 'testuser',
      iat: 1000,
      exp: 1,
    })).replace(/=/g, ''), 'fakesig'];
    const result = await verifyAccessToken(parts.join('.'));
    expect(result).toBeNull();
  });
});

describe('hashToken', () => {
  it('produces consistent hashes', async () => {
    const { hashToken } = await import('../auth');
    const h1 = hashToken('test-token');
    const h2 = hashToken('test-token');
    expect(h1).toBe(h2);
    expect(h1.length).toBe(64);
  });

  it('produces different hashes for different tokens', async () => {
    const { hashToken } = await import('../auth');
    const h1 = hashToken('token-a');
    const h2 = hashToken('token-b');
    expect(h1).not.toBe(h2);
  });
});

describe('generateRefreshToken', () => {
  it('generates token with correct prefix', async () => {
    const { generateRefreshToken } = await import('../auth');
    const token = generateRefreshToken();
    expect(token.startsWith('dqr_')).toBe(true);
    expect(token.length).toBe(4 + 64);
  });

  it('generates unique tokens', async () => {
    const { generateRefreshToken } = await import('../auth');
    const t1 = generateRefreshToken();
    const t2 = generateRefreshToken();
    expect(t1).not.toBe(t2);
  });
});
