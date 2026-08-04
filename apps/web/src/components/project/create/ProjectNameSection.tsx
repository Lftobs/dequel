import { Input } from '../../ui/input';
import { Globe, UserCheck, ShieldCheck } from 'lucide-react';

interface ProjectNameSectionProps {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  baseDomain: string;
  setBaseDomain: (v: string) => void;
}

export function ProjectNameSection({
  name,
  setName,
  description,
  setDescription,
  baseDomain,
  setBaseDomain,
}: ProjectNameSectionProps) {
  const generatedDomain = name
    ? `${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.${baseDomain || 'localhost'}`
    : `project-name.${baseDomain || 'localhost'}`;

  return (
    <div className="space-y-4 bg-[#0d0d10] border border-[#1f1f26] p-5 sm:p-6 rounded-2xl shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-orange-500" />
            Project Details & Domain
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Choose a unique project identifier and domain route.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Scope / Environment */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-zinc-300">
            Dequel Environment Scope
          </label>
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#121215] border border-[#22222a] text-xs text-zinc-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold">Local Platform Node</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Active
            </span>
          </div>
        </div>

        {/* Project Name Input */}
        <div className="space-y-1.5">
          <label htmlFor="project-name-input" className="block text-xs font-semibold text-zinc-300">
            Project Name <span className="text-orange-400">*</span>
          </label>
          <Input
            id="project-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-awesome-app"
            className="bg-[#121215] border-[#22222a] focus:border-orange-500 text-zinc-100 h-10 rounded-xl font-mono text-xs"
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="project-desc-input" className="block text-xs font-semibold text-zinc-300">
          Description (Optional)
        </label>
        <Input
          id="project-desc-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Production web application service with automated deployment"
          className="bg-[#121215] border-[#22222a] focus:border-orange-500 text-zinc-100 h-9 rounded-xl text-xs"
        />
      </div>

      {/* Base Domain & Live Ingress Preview */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <label htmlFor="project-domain-input" className="block text-xs font-semibold text-zinc-300">
            Custom Base Domain
          </label>
          <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
            <Globe className="h-3 w-3 text-orange-400" />
            Ingress Domain: <code className="text-orange-300 font-bold">{generatedDomain}</code>
          </span>
        </div>
        <Input
          id="project-domain-input"
          value={baseDomain}
          onChange={(e) => setBaseDomain(e.target.value)}
          placeholder="e.g. app.domain.com"
          className="bg-[#121215] border-[#22222a] focus:border-orange-500 text-zinc-100 h-9 rounded-xl text-xs"
        />
      </div>
    </div>
  );
}
