import { listServers, listProjects, ensureLocalServer, getServerById } from '../db/repo';
import { isServerPreparing } from '../servers/prepare';

const isServerHealthy = (s: Awaited<ReturnType<typeof listServers>>[number]): boolean => {
  if (isServerPreparing(s.id)) return false;
  if (s.mode === 'agent') {
    return !!s.lastHeartbeat && Date.now() - new Date(s.lastHeartbeat).getTime() <= 90_000;
  }
  if (s.mode === 'ssh') {
    return s.status === 'connected';
  }
  return false;
};

export const pickBestServer = async (
  preferredServerId?: string | null,
  excludeServerId?: string | null,
  modeFilter?: string[],
): Promise<string> => {
  if (preferredServerId && preferredServerId !== excludeServerId) {
    const preferred = await getServerById(preferredServerId);
    if (preferred && (preferred.mode === 'local' || isServerHealthy(preferred))) {
      if (!modeFilter || modeFilter.includes(preferred.mode)) return preferredServerId;
    }
  }
  const servers = await listServers();
  const projects = await listProjects();
  const projectCount = new Map<string, number>();
  for (const p of projects) {
    if (!p.serverId) continue;
    projectCount.set(p.serverId, (projectCount.get(p.serverId) ?? 0) + 1);
  }
  const candidates = servers
    .filter((s) =>
      (s.mode === 'ssh' || s.mode === 'agent') &&
      s.id !== excludeServerId &&
      isServerHealthy(s) &&
      (!modeFilter || modeFilter.includes(s.mode)),
    )
    .sort((a, b) => {
      const countDiff = (projectCount.get(a.id) ?? 0) - (projectCount.get(b.id) ?? 0);
      if (countDiff !== 0) return countDiff;
      return (a.cpuUsedPercent ?? 0) - (b.cpuUsedPercent ?? 0);
    });
  if (candidates.length > 0) return candidates[0].id;
  if (servers.some((s) => s.mode !== 'local' && !isServerHealthy(s))) {
    console.warn('[Placement] No healthy remote server available; falling back to local');
  }
  await ensureLocalServer();
  return 'local';
};

export const resolveDefaultServerId = pickBestServer;