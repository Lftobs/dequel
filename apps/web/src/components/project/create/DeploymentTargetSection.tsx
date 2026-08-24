import { Laptop, Server } from 'lucide-react';
import type { Server as DequelServer } from '../../../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { cn } from '../../../lib/utils';

export function getDeploymentTargets(servers: DequelServer[]): DequelServer[] {
  return servers.filter(
    (s) => s.status === 'connected' && (s.mode === 'local' || s.mode === 'ssh' || s.mode === 'agent'),
  );
}

interface DeploymentTargetSelectProps {
  serverId: string;
  setServerId: (v: string) => void;
  servers: DequelServer[];
}

export function DeploymentTargetSelect({ serverId, setServerId, servers }: DeploymentTargetSelectProps) {
  const targets = getDeploymentTargets(servers);

  return (
    <div className="grid gap-1.5">
      <label htmlFor="deployment-target" className="font-semibold text-zinc-400">
        Deployment Server
      </label>
      {targets.length > 0 ? (
        <Select value={serverId} onValueChange={setServerId}>
          <SelectTrigger
            id="deployment-target"
            className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9 rounded-lg"
          >
            <SelectValue placeholder="Select a deployment server" />
          </SelectTrigger>
          <SelectContent className="bg-[#141418] border-[#222227] text-zinc-200">
            {targets.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="flex items-center gap-2">
                  {s.mode === 'local' ? (
                    <Laptop className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <Server className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                  <span className="font-medium">
                    {s.mode === 'local' ? 'This Machine' : s.name}
                  </span>
                  <span className="text-zinc-500">({s.host})</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="h-9 rounded-lg border border-dashed border-[#222227] flex items-center px-3 text-xs text-zinc-500">
          No deployment servers available - project will be created on the local server.
        </div>
      )}
      <span className="text-[10px] text-zinc-500">
        Remote agents currently support Git sources with Railpack web builds.
      </span>
    </div>
  );
}

interface DeploymentTargetSectionProps extends DeploymentTargetSelectProps {
  className?: string;
}

export function DeploymentTargetSection({ serverId, setServerId, servers, className }: DeploymentTargetSectionProps) {
  return (
    <div className={cn('space-y-4 bg-[#0d0d10] border border-[#1f1f26] p-5 sm:p-6 rounded-2xl shadow-lg', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Server className="h-4 w-4 text-orange-500" />
            Deployment Target
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Choose which server runs this project's deployments.
          </p>
        </div>
      </div>
      <DeploymentTargetSelect serverId={serverId} setServerId={setServerId} servers={servers} />
    </div>
  );
}
