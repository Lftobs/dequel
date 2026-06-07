import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listDeployments, createDeployment, rollbackDeployment, redeployDeployment } from '../api/client';

export function useDeployments(projectId?: string, page = 0, pageSize = 10) {
  return useQuery({
    queryKey: ['deployments', projectId, page, pageSize],
    queryFn: () => listDeployments(projectId, page * pageSize, pageSize),
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

export function useRedeployDeployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => redeployDeployment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deployments'] }),
  });
}
