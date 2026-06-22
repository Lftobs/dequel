import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

export const loadOrCreateJwtSecret = async (dataDir: string): Promise<string> => {
  const path = join(dataDir, '.jwt_secret');
  try {
    const existing = await readFile(path, 'utf8');
    return existing.trim();
  } catch {
    await mkdir(dirname(path), { recursive: true });
    const secret = randomBytes(32).toString('hex');
    await writeFile(path, secret + '\n', { mode: 0o600 });
    return secret;
  }
};
