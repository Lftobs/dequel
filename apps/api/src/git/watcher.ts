import { getDb } from '../db/client';
import { listProjects } from '../db/repo';
import { createDeployment } from '../db/repo';
import { orchestrator } from '../orchestrator';
import { getRemoteSha } from '../orchestrator/source';

const POLL_INTERVAL_MS = 60_000;

let interval: ReturnType<typeof setInterval> | null = null;

export const startGitWatcher = () => {
  if (interval) return;
  interval = setInterval(poll, POLL_INTERVAL_MS);
  console.log('[GitWatcher] Started (poll every 60s)');
};

export const stopGitWatcher = () => {
  if (interval) { clearInterval(interval); interval = null; }
};

async function poll() {
  try {
    const db = await getDb();
    const projects = db.query(
      "SELECT * FROM projects WHERE repo_url IS NOT NULL AND repo_url != ''",
    ).all() as any[];

    for (const project of projects) {
      const branch = project.repo_branch || 'main';

      const latest = db.query(
        'SELECT * FROM deployments WHERE project_id = ? AND source_type = ? ORDER BY created_at DESC LIMIT 1',
      ).get(project.id, 'git') as any;

      if (!latest?.commit_sha) continue;

      const remoteSha = await getRemoteSha(project.repo_url, branch);
      if (!remoteSha) continue;

      if (remoteSha === latest.commit_sha) continue;

      console.log(`[GitWatcher] New commit detected for ${project.name} (${branch}): ${remoteSha.slice(0, 7)}`);

      const dep = await createDeployment({
        projectId: project.id,
        sourceType: 'git',
        sourceRef: project.repo_url,
        branch,
        commitSha: remoteSha,
      });

      orchestrator.enqueue(dep.id);
    }
  } catch (err) {
    console.error('[GitWatcher] Poll error:', err);
  }
}
