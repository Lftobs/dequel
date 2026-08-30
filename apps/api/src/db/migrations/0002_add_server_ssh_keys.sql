DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'servers'::regclass AND attname = 'ssh_key') THEN
    ALTER TABLE "servers" ADD COLUMN "ssh_key" text;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'servers'::regclass AND attname = 'ssh_password') THEN
    ALTER TABLE "servers" ADD COLUMN "ssh_password" text;
  END IF;
END $$;
