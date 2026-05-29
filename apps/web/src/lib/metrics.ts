export type ParsedMetrics = {
  requestsTotal?: number;
  activeDeployments?: number;
  uptimeSeconds?: number;
};

export function parseMetrics(text: string): ParsedMetrics {
  const metrics: ParsedMetrics = {
    requestsTotal: undefined,
    activeDeployments: undefined,
    uptimeSeconds: undefined,
  };

  for (const line of text.split('\n')) {
    if (line.startsWith('dequel_requests_total')) {
      metrics.requestsTotal = Number(line.split(' ').pop());
    } else if (line.startsWith('dequel_active_deployments')) {
      metrics.activeDeployments = Number(line.split(' ').pop());
    } else if (line.startsWith('dequel_uptime_seconds')) {
      metrics.uptimeSeconds = Number(line.split(' ').pop());
    }
  }

  return metrics;
}

export function formatUptime(seconds?: number) {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
