import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listProjects, createProject, deleteProject } from '../api/client';
import type { Project } from '../types';

export function useProjects() {
  return useQuery({ queryKey: ['projects'], queryFn: listProjects, refetchInterval: 10_000 });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => import('../api/client').then(m => m.getProject(id)),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createProject>[0]) => createProject(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['all-deployments'] });
    },
  });
}
