import { useState } from 'react';
import { Input } from '../../ui/input';
import { Terminal, Sliders, ChevronDown, FolderCode, Play } from 'lucide-react';

interface BuildSettingsSectionProps {
  buildCommand: string;
  setBuildCommand: (v: string) => void;
  installCommand: string;
  setInstallCommand: (v: string) => void;
  startCommand: string;
  setStartCommand: (v: string) => void;
  outputDir: string;
  setOutputDir: (v: string) => void;
  port: string;
  setPort: (v: string) => void;
  sourceDir: string;
  setSourceDir: (v: string) => void;
  projectType: string;
}

export function BuildSettingsSection({
  buildCommand,
  setBuildCommand,
  installCommand,
  setInstallCommand,
  startCommand,
  setStartCommand,
  outputDir,
  setOutputDir,
  port,
  setPort,
  sourceDir,
  setSourceDir,
  projectType,
}: BuildSettingsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="space-y-4 bg-[#0d0d10] border border-[#1f1f26] p-5 sm:p-6 rounded-2xl shadow-lg">
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-orange-500" />
            Build & Output Settings
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Pre-configured from preset. Expand to inspect or override build commands.
          </p>
        </div>
        <button
          type="button"
          className="p-1.5 rounded-lg bg-[#14141a] border border-[#22222c] text-zinc-400 hover:text-white"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              isExpanded ? 'transform rotate-180 text-orange-400' : ''
            }`}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#1a1a22]">
          {/* Build Command */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-orange-400" />
              Build Command
            </label>
            <Input
              value={buildCommand}
              onChange={(e) => setBuildCommand(e.target.value)}
              placeholder="e.g. npm run build"
              className="bg-[#121215] border-[#22222a] focus:border-orange-500 text-zinc-100 h-9 rounded-xl font-mono text-xs"
            />
          </div>

          {/* Output Directory */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <FolderCode className="h-3.5 w-3.5 text-emerald-400" />
              Output Directory
            </label>
            <Input
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              placeholder="e.g. .next or dist"
              className="bg-[#121215] border-[#22222a] focus:border-orange-500 text-zinc-100 h-9 rounded-xl font-mono text-xs"
            />
          </div>

          {/* Install Command */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-blue-400" />
              Install Command
            </label>
            <Input
              value={installCommand}
              onChange={(e) => setInstallCommand(e.target.value)}
              placeholder="e.g. npm install"
              className="bg-[#121215] border-[#22222a] focus:border-orange-500 text-zinc-100 h-9 rounded-xl font-mono text-xs"
            />
          </div>

          {/* Start Command (for Web Service) */}
          {projectType === 'web' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5 text-purple-400" />
                Start Command
              </label>
              <Input
                value={startCommand}
                onChange={(e) => setStartCommand(e.target.value)}
                placeholder="e.g. npm run start"
                className="bg-[#121215] border-[#22222a] focus:border-orange-500 text-zinc-100 h-9 rounded-xl font-mono text-xs"
              />
            </div>
          )}

          {/* Port */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              Listen Port
            </label>
            <Input
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="Auto-detected (e.g. 3000)"
              className="bg-[#121215] border-[#22222a] focus:border-orange-500 text-zinc-100 h-9 rounded-xl font-mono text-xs"
            />
          </div>

          {/* Root Directory */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              Root Directory
            </label>
            <Input
              value={sourceDir}
              onChange={(e) => setSourceDir(e.target.value)}
              placeholder="./ (Root)"
              className="bg-[#121215] border-[#22222a] focus:border-orange-500 text-zinc-100 h-9 rounded-xl font-mono text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
