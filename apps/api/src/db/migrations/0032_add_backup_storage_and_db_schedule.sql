ALTER TABLE databases ADD COLUMN IF NOT EXISTS backup_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE databases ADD COLUMN IF NOT EXISTS backup_schedule TEXT NOT NULL DEFAULT '0 */6 * * *';
ALTER TABLE databases ADD COLUMN IF NOT EXISTS backup_retention INTEGER NOT NULL DEFAULT 7;

CREATE TABLE IF NOT EXISTS backup_storage_settings (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'local',
  path TEXT DEFAULT '/data/backups',
  s3_endpoint TEXT,
  s3_access_key_id TEXT,
  s3_secret_access_key_encrypted TEXT,
  s3_secret_access_key_iv TEXT,
  s3_secret_access_key_tag TEXT,
  s3_bucket TEXT,
  s3_region TEXT DEFAULT 'auto',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
