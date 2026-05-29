import { rm } from 'node:fs/promises';
import { appendLog, getDeploymentById, getProjectById, listDeployments, listAllDatabases, updateDeploymentStatus, updateDeploymentCommitSha } from '../db/repo';
import { listEnvironmentVariablesForDeploy } from '../db/repo';
import { listVolumes } from '../db/repo';
import { logBus } from './log-bus';
import { DeploymentQueue } from './queue';
import { buildWithRailpack } from './railpack';
import { prepareSourceWorkspace, prepareUploadWorkspace, cleanupWorkspace, getHeadSha } from './source';
import { deployContainer, ensureContainerRunning, reloadCaddy } from './runtime';

const now = () => new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

const emitLog = async (
  deploymentId: string,
  stage: 'build' | 'deploy' | 'system',
  message: string,
) => {
  const timestamp = now();
  const saved = await appendLog(deploymentId, stage, message);
  logBus.publish({ deploymentId, sequence: saved.sequence, stage, message, timestamp });
};

export class PipelineOrchestrator {
  private queue: DeploymentQueue;
  private started = false;

  constructor() {
    this.queue = new DeploymentQueue();
  }

  startWorker() {
    if (this.started) return;
    this.started = true;
    this.queue.start(async (deploymentId) => {
      return this.runDeployment(deploymentId);
    }).catch((error) => console.error('Queue worker failed', error));
  }

  enqueue(deploymentId: string) {
    this.queue.enqueue(deploymentId).catch((error) => console.error('Queue enqueue failed', error));
  }

  async reconcileState() {
    console.log('Reconciling deployment state...');

    // Reconcile running deployment containers
    const deployments = await listDeployments();
    const running = deployments.filter((d) => d.status === 'running');
    for (const deployment of running) {
      if (deployment.containerName) {
        console.log(`Ensuring container ${deployment.containerName} is running`);
        await ensureContainerRunning(deployment.containerName);
      }
    }

    const resumable = deployments
      .filter((d) => d.status === 'pending' || d.status === 'building' || d.status === 'deploying')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (resumable.length > 0) {
      console.log(`Requeuing ${resumable.length} deployments after restart`);
      for (const deployment of resumable) {
        await emitLog(deployment.id, 'system', `Resuming deployment after restart (status was ${deployment.status})`);
        this.enqueue(deployment.id);
      }
    }
    try { await reloadCaddy(); console.log('Caddy reloaded during reconciliation'); }
    catch { console.log('Caddy not ready for reload during reconciliation'); }

    // Reconcile running database containers
    const databases = await listAllDatabases();
    const runningDbs = databases.filter((d) => d.status === 'running');
    for (const db of runningDbs) {
      console.log(`Ensuring database container ${db.internalHost} is running`);
      await ensureContainerRunning(db.internalHost);
    }
  }

  private async runDeployment(deploymentId: string): Promise<boolean> {
    const deployment = await getDeploymentById(deploymentId);
    if (!deployment) return true;

    let workspacePath = '';
    let uploadedArchivePath: string | null = null;

    try {
      await emitLog(deploymentId, 'system', 'Deployment enqueued');

      const imageTag = deployment.sourceType === 'image'
        ? deployment.sourceRef
        : `dequel-${deploymentId}:latest`;

      if (deployment.sourceType !== 'image') {
        await updateDeploymentStatus(deploymentId, 'building', { failureReason: null });

        if (deployment.sourceType === 'git') {
          const branchLabel = deployment.branch ? ` (branch ${deployment.branch})` : '';
          await emitLog(deploymentId, 'build', `Cloning git repository: ${deployment.sourceRef}${branchLabel}`);
          workspacePath = await prepareSourceWorkspace(deploymentId, deployment.sourceRef, deployment.branch ?? undefined);
          const sha = await getHeadSha(workspacePath);
          if (sha) {
            await updateDeploymentCommitSha(deploymentId, sha);
            await emitLog(deploymentId, 'build', `Commit: ${sha.slice(0, 7)}`);
          }
        } else {
          await emitLog(deploymentId, 'build', `Extracting archive: ${deployment.sourceRef}`);
          uploadedArchivePath = deployment.sourceRef;
          workspacePath = await prepareUploadWorkspace(deploymentId, deployment.sourceRef);
        }

        await emitLog(deploymentId, 'build', `Source prepared at: ${workspacePath}`);
        const cacheKey = deployment.projectId || deploymentId;
        await buildWithRailpack(workspacePath, imageTag, async (line) => {
          await emitLog(deploymentId, 'build', line);
        }, { cacheKey });
      } else {
        await emitLog(deploymentId, 'build', `Rolling back to existing image: ${imageTag}`);
      }

      await updateDeploymentStatus(deploymentId, 'deploying', { imageTag });
      await emitLog(deploymentId, 'deploy', 'Starting container deployment');

      // Load env vars from project
      let envVars: Record<string, string> | undefined;
      if (deployment.projectId) {
        const vars = await listEnvironmentVariablesForDeploy(deployment.projectId, deployment.environment ?? undefined);
        if (vars.length > 0) {
          envVars = {};
          for (const v of vars) envVars[v.key] = v.value;
          await emitLog(deploymentId, 'deploy', `Injecting ${vars.length} environment variables`);
        }
      }

      // Load volumes from project
      let volumes: { volumeName: string; mountPath: string }[] | undefined;
      if (deployment.projectId) {
        const vols = await listVolumes(deployment.projectId);
        if (vols.length > 0) {
          volumes = vols.map(v => ({
            volumeName: v.dockerVolumeName ?? `vol-${v.id.slice(0, 12)}`,
            mountPath: v.mountPath,
          }));
          await emitLog(deploymentId, 'deploy', `Mounting ${vols.length} persistent volumes`);
        }
      }

      // Find old container for zero-downtime swap
      let oldContainerName: string | undefined;
      if (deployment.projectId) {
        const all = await listDeployments(deployment.projectId);
        const prev = all.find(d =>
          d.projectId === deployment.projectId &&
          d.status === 'running' &&
          d.id !== deploymentId,
        );
        if (prev?.containerName) {
          oldContainerName = prev.containerName;
          await emitLog(deploymentId, 'deploy', `Found existing deployment ${prev.id} (${oldContainerName}) for zero-downtime swap`);
        }
      }

      // Load project name for URL
      let projectName: string | undefined;
      let cpuLimit: number | null | undefined;
      let memoryLimitMb: number | null | undefined;
      if (deployment.projectId) {
        const proj = await getProjectById(deployment.projectId);
        if (proj) {
          projectName = proj.name;
          cpuLimit = proj.cpuLimit;
          memoryLimitMb = proj.memoryLimitMb;
        }
      }

      const runtime = await deployContainer(deploymentId, imageTag, async (line) => {
        await emitLog(deploymentId, 'deploy', line);
      }, {
        projectId: deployment.projectId || undefined,
        projectName,
        oldContainerName,
        envVars,
        volumes,
        cpuLimit,
        memoryLimitMb,
      });

      await updateDeploymentStatus(deploymentId, 'running', {
        imageTag,
        containerName: runtime.containerName,
        liveUrl: runtime.liveUrl,
        failureReason: null,
      });

      if (oldContainerName && deployment.projectId) {
        const all = await listDeployments(deployment.projectId);
        const prev = all.find(d => d.containerName === oldContainerName && d.id !== deploymentId);
        if (prev) {
          await updateDeploymentStatus(prev.id, 'inactive', { failureReason: 'Superseded by new deployment' });
          await emitLog(prev.id, 'system', `Deployment marked inactive (superseded by ${deploymentId})`);
        }
      }

      await emitLog(deploymentId, 'system', 'Deployment is running');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown deployment failure';
      console.error(`[Orchestrator] Deployment ${deploymentId} failed:`, error);
      await emitLog(deploymentId, 'system', `CRITICAL FAILURE: ${message}`);
      await updateDeploymentStatus(deploymentId, 'failed', { failureReason: message });
      if (deployment.projectId) {
        try {
          const dbs = await listAllDatabases(deployment.projectId);
          for (const db of dbs) {
            if (db.status !== 'running') continue;
            await ensureContainerRunning(db.internalHost);
          }
        } catch (dbErr) {
          console.error(`[Orchestrator] DB reconcile failed for ${deploymentId}:`, dbErr);
        }
      }
      return false;
    } finally {
      if (workspacePath) await cleanupWorkspace(workspacePath);
      if (uploadedArchivePath) await rm(uploadedArchivePath, { force: true });
    }
  }
}

export const orchestrator = new PipelineOrchestrator();
