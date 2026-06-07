import { Input } from '../ui/input';
import { Sliders, GitBranch } from 'lucide-react';

interface StepBasicsProps {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  baseDomain: string;
  setBaseDomain: (v: string) => void;
  repoUrl: string;
  setRepoUrl: (v: string) => void;
  repoBranch: string;
  setRepoBranch: (v: string) => void;
}

export function StepBasics({
  name,
  setName,
  description,
  setDescription,
  baseDomain,
  setBaseDomain,
  repoUrl,
  setRepoUrl,
  repoBranch,
  setRepoBranch
}: StepBasicsProps) {
  return (
    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
      <div className="space-y-3.5 bg-[#0c0c0e]/60 p-4 rounded-xl border border-[#222227]">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Sliders className="h-3.5 w-3.5 text-amber-500" />
          General Settings
        </h4>
        <div className="grid gap-3.5 sm:grid-cols-2 text-xs">
          <div className="grid gap-1.5 sm:col-span-2">
            <label htmlFor="name" className="font-semibold text-zinc-400">Project Name *</label>
            <Input
              id="name"
              placeholder="e.g. my-awesome-app"
              className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <label htmlFor="desc" className="font-semibold text-zinc-400">Description</label>
            <Input
              id="desc"
              placeholder="e.g. Frontend React static dashboard"
              className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <label htmlFor="domain" className="font-semibold text-zinc-400">Custom Ingress Base Domain</label>
            <Input
              id="domain"
              placeholder="e.g. app.mycompany.com"
              className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
              value={baseDomain}
              onChange={e => setBaseDomain(e.target.value)}
            />
            <span className="text-[10px] text-zinc-500">
              Leave empty to auto-assign a default hostname on localhost caddy ingress router.
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3.5 bg-[#0c0c0e]/60 p-4 rounded-xl border border-[#222227]">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-amber-500" />
          Git Repository Details
        </h4>
        <div className="grid gap-3.5 sm:grid-cols-3 text-xs">
          <div className="grid gap-1.5 sm:col-span-2">
            <label htmlFor="repoUrl" className="font-semibold text-zinc-400">Git Repository URL</label>
            <Input
              id="repoUrl"
              placeholder="https://github.com/username/repository.git"
              className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="repoBranch" className="font-semibold text-zinc-400">Default Branch</label>
            <Input
              id="repoBranch"
              placeholder="main"
              className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
              value={repoBranch}
              onChange={e => setRepoBranch(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
