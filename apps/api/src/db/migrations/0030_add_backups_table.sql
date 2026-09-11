CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  engine TEXT NOT NULL,
  filename TEXT,
  storage_type TEXT NOT NULL,
  storage_path TEXT,
  size_bytes INTEGER,
  error TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backups_target ON backups(target_id);
CREATE INDEX IF NOT EXISTS idx_backups_created ON backups(created_at);
CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);
