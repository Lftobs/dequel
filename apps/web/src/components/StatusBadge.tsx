import { Badge } from './ui/badge';

const statusMap: Record<string, 'success' | 'warning' | 'destructive' | 'info' | 'secondary'> = {
  running: 'success',
  success: 'success',
  deployed: 'success',
  verified: 'success',
  active: 'success',
  provisioning: 'warning',
  building: 'info',
  deploying: 'info',
  pending: 'warning',
  failed: 'destructive',
  error: 'destructive',
  inactive: 'secondary',
  cancelled: 'secondary',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={statusMap[status] ?? 'secondary'}>{status}</Badge>;
}
