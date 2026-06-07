import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLogs, streamLogsUrl, getRuntimeLogs, streamRuntimeLogsUrl, getRequestLogs, streamRequestLogsUrl } from '../api/client';
import type { Log } from '../types';

export function useDeploymentLogs(deploymentId: string | null) {
  const [liveLogs, setLiveLogs] = useState<Log[]>([]);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['logs', deploymentId],
    queryFn: () => getLogs(deploymentId!),
    enabled: !!deploymentId,
    refetchInterval: false,
  });

  useEffect(() => {
    if (!deploymentId) {
      setLiveLogs([]);
      return;
    }
    setLiveLogs([]);
    const url = streamLogsUrl(deploymentId);
    const source = new EventSource(url);
    source.addEventListener('log', (e) => {
      try {
        const log = JSON.parse(e.data);
        setLiveLogs(prev => [...prev, log]);
      } catch {}
    });
    source.addEventListener('ready', () => {});
    source.onerror = () => {};
    return () => source.close();
  }, [deploymentId]);

  const merged = new Map<number, Log>();
  for (const log of history) merged.set(log.sequence, log);
  for (const log of liveLogs) merged.set(log.sequence, log);
  const logs = Array.from(merged.values()).sort((a, b) => a.sequence - b.sequence);
  return { logs, isLoading };
}

export function useRuntimeLogs(deploymentId: string | null, isLive: boolean = true) {
  const [liveLogs, setLiveLogs] = useState<Log[]>([]);

  const { data: history = [], isLoading, refetch } = useQuery({
    queryKey: ['runtime-logs', deploymentId],
    queryFn: () => getRuntimeLogs(deploymentId!),
    enabled: !!deploymentId,
    refetchInterval: false,
  });

  useEffect(() => {
    if (!deploymentId || !isLive) {
      setLiveLogs([]);
      return;
    }
    setLiveLogs([]);
    const url = streamRuntimeLogsUrl(deploymentId);
    const source = new EventSource(url);
    source.addEventListener('log', (e) => {
      try {
        const log = JSON.parse(e.data);
        setLiveLogs(prev => [...prev, log]);
      } catch {}
    });
    source.addEventListener('ready', () => {});
    source.onerror = () => {};
    return () => source.close();
  }, [deploymentId, isLive]);

  const merged = new Map<string, Log>();
  for (const log of history) {
    const key = `${log.sequence}-${log.message}`;
    merged.set(key, log);
  }
  for (const log of liveLogs) {
    const key = `${log.sequence}-${log.message}`;
    merged.set(key, log);
  }
  const logs = Array.from(merged.values()).sort((a, b) => {
    const timeA = new Date((a as any).timestamp || a.createdAt).getTime();
    const timeB = new Date((b as any).timestamp || b.createdAt).getTime();
    return timeA - timeB || a.sequence - b.sequence;
  });
  return { logs, isLoading, refetch };
}

export function useRequestLogs(
  projectId: string | null,
  isLive: boolean = true,
  start: number | null = null,
  end: number | null = null
) {
  const [liveLogs, setLiveLogs] = useState<Log[]>([]);

  // If a date range is in use, start or end will be non-null.
  // In that case, we should disable live streaming (i.e. isStreamingActive = false).
  const isDateRangeInUse = start !== null || end !== null;
  const isStreamingActive = isLive && !isDateRangeInUse;

  const { data: history = [], isLoading, refetch } = useQuery({
    queryKey: ['request-logs', projectId, start, end],
    queryFn: () => getRequestLogs(projectId!, start, end),
    enabled: !!projectId,
    refetchInterval: false,
  });

  useEffect(() => {
    if (!projectId || !isStreamingActive) {
      setLiveLogs([]);
      return;
    }
    setLiveLogs([]);
    const url = streamRequestLogsUrl(projectId);
    const source = new EventSource(url);
    source.addEventListener('log', (e) => {
      try {
        const log = JSON.parse(e.data);
        setLiveLogs(prev => [...prev, log]);
      } catch {}
    });
    source.addEventListener('ready', () => {});
    source.onerror = () => {};
    return () => source.close();
  }, [projectId, isStreamingActive]);

  const merged = new Map<string, Log>();
  for (const log of history) {
    const key = `${log.sequence}-${log.message}`;
    merged.set(key, log);
  }
  // Only merge live logs if streaming is active (i.e. we are NOT filtering by date range)
  if (isStreamingActive) {
    for (const log of liveLogs) {
      const key = `${log.sequence}-${log.message}`;
      merged.set(key, log);
    }
  }

  const logs = Array.from(merged.values()).sort((a, b) => {
    const timeA = new Date((a as any).timestamp || a.createdAt).getTime();
    const timeB = new Date((b as any).timestamp || b.createdAt).getTime();
    return timeB - timeA || b.sequence - a.sequence;
  });
  return { logs, isLoading, refetch };
}

