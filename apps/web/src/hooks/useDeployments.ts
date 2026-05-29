import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listDeployments, createDeployment, rollbackDeployment } from '../api/client';

export function useDeployments(projectId?: string) {
  return useQuery({
    queryKey: ['deployments', projectId],
    queryFn: () => listDeployments(projectId),
    refetchInterval: 5000,
  });
}

export function useCreateDeployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => createDeployment(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deployments'] }),
  });
}

export function useRollbackDeployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rollbackDeployment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deployments'] }),
  });
}
