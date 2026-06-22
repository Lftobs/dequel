import { randomBytes } from 'node:crypto';
import { getDrizzle } from '../db/drizzle';
import { eq, and, sql } from 'drizzle-orm';
import { refreshTokens } from '../db/schema';

let jwtSecret = '';

export const initAuth = (secret: string) => {
  jwtSecret = secret;
};

const b64url = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const b64urlDecode = (str: string): ArrayBuffer => {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0)).buffer;
};

const encoder = new TextEncoder();

const hmacSign = async (data: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(jwtSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return b64url(sig);
};

export interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
}

export const signAccessToken = async (username: string): Promise<string> => {
  const header = b64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(encoder.encode(JSON.stringify({
    sub: username,
    iat: now,
    exp: now + 900,
  })));
  const sig = await hmacSign(`${header}.${payload}`);
  return `${header}.${payload}.${sig}`;
};

export const verifyAccessToken = async (token: string): Promise<JwtPayload | null> => {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = await hmacSign(`${header}.${payload}`);
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
};

export const hashToken = (token: string): string => {
  const hash = Bun.CryptoHasher.hash('sha256', token);
  return Buffer.from(hash).toString('hex');
};

export const generateRefreshToken = (): string =>
  `dqr_${randomBytes(32).toString('hex')}`;

export const storeRefreshToken = async (username: string, token: string): Promise<void> => {
  const drizzle = await getDrizzle();
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const id = randomBytes(16).toString('hex');
  drizzle.insert(refreshTokens).values({
    id,
    username,
    tokenHash,
    expiresAt,
    createdAt: now,
  }).run();
};

export const validateRefreshToken = async (token: string): Promise<string | null> => {
  const drizzle = await getDrizzle();
  const tokenHash = hashToken(token);
  const row = drizzle.select().from(refreshTokens)
    .where(and(
      eq(refreshTokens.tokenHash, tokenHash),
      sql`${refreshTokens.blacklistedAt} IS NULL`,
      sql`${refreshTokens.expiresAt} > datetime('now')`,
    ))
    .get();
  return row?.username ?? null;
};

export const blacklistRefreshToken = async (token: string): Promise<void> => {
  const drizzle = await getDrizzle();
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();
  drizzle.update(refreshTokens)
    .set({ blacklistedAt: now })
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .run();
};

export const cleanupExpiredTokens = async (): Promise<void> => {
  const drizzle = await getDrizzle();
  drizzle.run(sql`DELETE FROM refresh_tokens WHERE expires_at < datetime('now')`);
};
