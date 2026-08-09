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
}: Omit<ProjectNameSectionProps, 'baseDomain' | 'setBaseDomain'>) {
  return (
    <div className="space-y-4 bg-[#0d0d10] border border-[#1f1f26] p-5 sm:p-6 rounded-2xl shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-orange-500" />
            Project Details
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Choose a unique project name and description for your deployment.
          </p>
        </div>
      </div>

      <div className="space-y-4">
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
      </div>
    </div>
  );
}
