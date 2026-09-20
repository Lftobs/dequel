ALTER TABLE backup_storage_settings ADD COLUMN system_backup_schedule text DEFAULT '0 */6 * * *';
ALTER TABLE backup_storage_settings ADD COLUMN system_backup_retention integer DEFAULT 7;
