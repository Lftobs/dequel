ALTER TABLE "agent_jobs" DROP CONSTRAINT IF EXISTS "agent_jobs_deployment_id_deployments_id_fk";
ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_deployment_id_deployments_id_fk"
  FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE CASCADE;

ALTER TABLE "deployment_logs" DROP CONSTRAINT IF EXISTS "deployment_logs_deployment_id_deployments_id_fk";
ALTER TABLE "deployment_logs" ADD CONSTRAINT "deployment_logs_deployment_id_deployments_id_fk"
  FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE CASCADE;

ALTER TABLE "deployment_events" DROP CONSTRAINT IF EXISTS "deployment_events_deployment_id_deployments_id_fk";
ALTER TABLE "deployment_events" ADD CONSTRAINT "deployment_events_deployment_id_deployments_id_fk"
  FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE CASCADE;
