import { Database } from 'bun:sqlite';
import { config } from '../utils/config';

let db: Database | null = null;

export const getDb = async () => {
  if (!db) {
    db = new Database(config.databasePath, { create: true });
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA busy_timeout = 15000;");
    db.exec("PRAGMA synchronous = NORMAL;");
  }
  return db;
};
