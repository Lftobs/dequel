ALTER TABLE deployment_events ADD COLUMN sent_at timestamptz;
ALTER TABLE deployment_events ADD COLUMN attempts integer NOT NULL DEFAULT 0;

UPDATE deployment_events SET sent_at = now() WHERE type = 'failed';

DELETE FROM deployment_events a USING deployment_events b
  WHERE a.deployment_id = b.deployment_id AND a.type = b.type AND a.ctid < b.ctid;

CREATE UNIQUE INDEX udep_events_failed ON deployment_events (deployment_id) WHERE type = 'failed';
CREATE UNIQUE INDEX udep_events_cancelled ON deployment_events (deployment_id) WHERE type = 'cancelled';

CREATE FUNCTION deployment_terminal_event_fallback() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM deployment_events
                 WHERE deployment_id = NEW.id AND type IN ('failed','cancelled')) THEN
    INSERT INTO deployment_events (id, deployment_id, type, message, metadata)
    VALUES (gen_random_uuid()::text, NEW.id, 'failed', NEW.failure_reason,
            jsonb_build_object('source', 'status-trigger'))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deployment_terminal_event
AFTER UPDATE OF status ON deployments
FOR EACH ROW WHEN (NEW.status = 'failed' AND OLD.status IS DISTINCT FROM 'failed')
EXECUTE FUNCTION deployment_terminal_event_fallback();

DELETE FROM alerts WHERE type = 'error_rate';
