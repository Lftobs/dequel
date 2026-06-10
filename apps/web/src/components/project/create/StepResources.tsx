import { Input } from '../../ui/input';
import { cn } from '../../../lib/utils';
import { Sliders, Database } from 'lucide-react';

interface StepResourcesProps {
  cpuLimit: string;
  setCpuLimit: (v: string) => void;
  memoryLimitMb: string;
  setMemoryLimitMb: (v: string) => void;
  provisionDb: boolean;
  setProvisionDb: (v: boolean) => void;
  dbType: 'postgresql' | 'mysql';
  setDbType: (v: 'postgresql' | 'mysql') => void;
  dbVersion: string;
  setDbVersion: (v: string) => void;
  dbCpu: string;
  setDbCpu: (v: string) => void;
  dbMemory: string;
  setDbMemory: (v: string) => void;
}

export function StepResources({
  cpuLimit,
  setCpuLimit,
  memoryLimitMb,
  setMemoryLimitMb,
  provisionDb,
  setProvisionDb,
  dbType,
  setDbType,
  dbVersion,
  setDbVersion,
  dbCpu,
  setDbCpu,
  dbMemory,
  setDbMemory
}: StepResourcesProps) {
  return (
    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
      <div className="space-y-3.5 bg-[#0c0c0e]/60 p-4 rounded-xl border border-[#222227]">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Sliders className="h-3.5 w-3.5 text-amber-500" />
          Cluster Resource Limits
        </h4>
        <div className="grid gap-3.5 sm:grid-cols-2 text-xs">
          <div className="grid gap-1.5">
            <label htmlFor="cpuLimit" className="font-semibold text-zinc-400">CPU Allocation (cores)</label>
            <Input
              id="cpuLimit"
              type="number"
              min="0"
              step="0.1"
              placeholder="e.g. 1 (optional)"
              className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
              value={cpuLimit}
              onChange={e => setCpuLimit(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="memoryLimitMb" className="font-semibold text-zinc-400">Memory Allocation (MB)</label>
            <Input
              id="memoryLimitMb"
              type="number"
              min="0"
              step="64"
              placeholder="e.g. 512 (optional)"
              className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
              value={memoryLimitMb}
              onChange={e => setMemoryLimitMb(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className={cn(
        "p-4 rounded-xl border transition-all space-y-4",
        provisionDb 
          ? "bg-gradient-to-b from-amber-500/5 to-rose-500/5 border-amber-500/20 shadow-md" 
          : "bg-[#0c0c0e]/60 border-[#222227]"
      )}>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <Database className={cn("h-4 w-4", provisionDb ? "text-amber-500 animate-pulse" : "text-zinc-500")} />
              Database Provisioning
            </h4>
            <p className="text-[10px] text-zinc-500 leading-normal">
              Spin up an isolated, dedicated database container on your cluster network.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setProvisionDb(!provisionDb)}
            className={cn(
              "w-10 h-5.5 rounded-full p-0.5 transition-colors relative focus:outline-none border",
              provisionDb ? "bg-amber-500 border-amber-600" : "bg-zinc-900 border-zinc-800"
            )}
          >
            <div className={cn(
              "w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
              provisionDb ? "translate-x-4.5" : "translate-x-0"
            )} />
          </button>
        </div>

        {provisionDb && (
          <div className="pt-2 border-t border-[#222227] space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDbType('postgresql')}
                className={cn(
                  "p-3 rounded-lg border text-left flex items-start gap-3 transition-all",
                  dbType === 'postgresql'
                    ? "bg-[#141418] border-amber-500/40 shadow-sm"
                    : "bg-transparent border-zinc-800 hover:border-zinc-700"
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-950/30 border border-emerald-900/40 flex items-center justify-center shrink-0 select-none">
                  <span className="text-[11px] font-bold text-emerald-400">PSQL</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-300">PostgreSQL</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5 leading-normal">Enterprise SQL Database</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDbType('mysql')}
                className={cn(
                  "p-3 rounded-lg border text-left flex items-start gap-3 transition-all",
                  dbType === 'mysql'
                    ? "bg-[#141418] border-amber-500/40 shadow-sm"
                    : "bg-transparent border-zinc-800 hover:border-zinc-700"
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-orange-950/30 border border-orange-900/40 flex items-center justify-center shrink-0 select-none">
                  <span className="text-[11px] font-bold text-orange-400">MY</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-300">MySQL</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5 leading-normal">Reliable & Structured DB</p>
                </div>
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="grid gap-1.5">
                <label htmlFor="dbVersion" className="text-zinc-400 font-semibold">Image Version</label>
                <Input
                  id="dbVersion"
                  placeholder={dbType === 'mysql' ? '8.0' : '16-alpine'}
                  className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9 font-mono"
                  value={dbVersion}
                  onChange={e => setDbVersion(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="dbCpu" className="text-zinc-400 font-semibold">CPU Allocation (cores)</label>
                <Input
                  id="dbCpu"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="e.g. 0.5 (optional)"
                  className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
                  value={dbCpu}
                  onChange={e => setDbCpu(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="dbMemory" className="text-zinc-400 font-semibold">Memory Limit (MB)</label>
                <Input
                  id="dbMemory"
                  type="number"
                  min="0"
                  step="64"
                  placeholder="e.g. 256 (optional)"
                  className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
                  value={dbMemory}
                  onChange={e => setDbMemory(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
