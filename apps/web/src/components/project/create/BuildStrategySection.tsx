import { FrameworkPreset } from '../../../utils/presets';
import { FrameworkSelect } from '../../ui/FrameworkSelect';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Container, Globe, Box, FolderCode, Terminal, Sliders, Play, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface ComposeServiceRow {
  id: string;
  serviceName: string;
  port: string;
  subdomain: string;
}

interface BuildStrategySectionProps {
  buildType: 'railpack' | 'compose';
  setBuildType: (v: 'railpack' | 'compose') => void;
  projectType: string;
  setProjectType: (v: string) => void;
  selectedPresetId: string;
  onSelectPreset: (preset: FrameworkPreset) => void;
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
  composeServicesList: ComposeServiceRow[];
  addComposeServiceRow: () => void;
  removeComposeServiceRow: (id: string) => void;
  updateComposeServiceRow: (id: string, field: 'serviceName' | 'port' | 'subdomain', value: string) => void;
}

export function BuildStrategySection({
  buildType,
  setBuildType,
  projectType,
  setProjectType,
  selectedPresetId,
  onSelectPreset,
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
  composeServicesList,
  addComposeServiceRow,
  removeComposeServiceRow,
  updateComposeServiceRow,
}: BuildStrategySectionProps) {
  return (
    <div className="space-y-6 bg-[#0d0d10] border border-[#1f1f26] p-5 sm:p-6 rounded-2xl shadow-lg">
      <div>
        <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <Container className="h-4 w-4 text-orange-500" />
          Build & Runtime Strategy
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Select how Dequel builds and manages your application containers.
        </p>
      </div>

      {/* Build Strategy Selection Cards (Railpack vs Docker Compose) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setBuildType('railpack')}
          className={cn(
            'p-4 rounded-xl border text-left transition-all space-y-1.5',
            buildType === 'railpack'
              ? 'bg-orange-500/10 border-orange-500/40 text-orange-400 ring-1 ring-orange-500/20'
              : 'bg-[#121215] border-[#22222a] text-zinc-400 hover:border-zinc-700'
          )}
        >
          <div className="flex items-center justify-between">
            <Container className="h-5 w-5 text-orange-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500/20 text-orange-300">
              Automatic Build
            </span>
          </div>
          <div className="font-bold text-xs text-zinc-100">Railpack Engine</div>
          <p className="text-[11px] text-zinc-400">
            Auto-detect language, install dependencies, compile, and run in isolated container.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setBuildType('compose')}
          className={cn(
            'p-4 rounded-xl border text-left transition-all space-y-1.5',
            buildType === 'compose'
              ? 'bg-orange-500/10 border-orange-500/40 text-orange-400 ring-1 ring-orange-500/20'
              : 'bg-[#121215] border-[#22222a] text-zinc-400 hover:border-zinc-700'
          )}
        >
          <div className="flex items-center justify-between">
            <Box className="h-5 w-5 text-blue-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
              Multi-Container
            </span>
          </div>
          <div className="font-bold text-xs text-zinc-100">Docker Compose</div>
          <p className="text-[11px] text-zinc-400">
            Orchestrate multi-service apps via <code className="text-zinc-200">docker-compose.yml</code> in repo root.
          </p>
        </button>
      </div>

      {/* Railpack Configuration */}
      {buildType === 'railpack' && (
        <div className="space-y-6 pt-4 border-t border-[#1a1a22]">
          {/* Framework Preset Select (with SVG logos) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              Application Preset
            </label>
            <FrameworkSelect
              selectedPresetId={selectedPresetId}
              onSelectPreset={onSelectPreset}
            />
          </div>

          {/* Project Type Card Selection (Web Service vs Static Site) */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-300">Project Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setProjectType('web')}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all space-y-1.5',
                  projectType === 'web'
                    ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
                    : 'bg-[#121215] border-[#22222a] text-zinc-400 hover:border-zinc-700'
                )}
              >
                <div className="flex items-center justify-between">
                  <Globe className="h-5 w-5 text-orange-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500/20 text-orange-300">
                    Dynamic Server
                  </span>
                </div>
                <div className="font-bold text-xs text-zinc-100">Web Service</div>
                <p className="text-[11px] text-zinc-400">
                  Node.js, Elysia, Express, Next.js (SSR), Go, Python server container.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProjectType('static')}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all space-y-1.5',
                  projectType === 'static'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-[#121215] border-[#22222a] text-zinc-400 hover:border-zinc-700'
                )}
              >
                <div className="flex items-center justify-between">
                  <FolderCode className="h-5 w-5 text-emerald-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    Static Site
                  </span>
                </div>
                <div className="font-bold text-xs text-zinc-100">Static Site / SPA</div>
                <p className="text-[11px] text-zinc-400">
                  React, Vite, Astro, Vue static export served via lightweight HTTP file server.
                </p>
              </button>
            </div>
          </div>

          {/* Detailed Build Commands */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-orange-400" />
                Build Command
              </label>
              <Input
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                placeholder="e.g. npm run build"
                className="bg-[#121215] border-[#22222a] text-zinc-100 h-9 rounded-xl font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <FolderCode className="h-3.5 w-3.5 text-emerald-400" />
                Output Directory
              </label>
              <Input
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
                placeholder="e.g. .next or dist"
                className="bg-[#121215] border-[#22222a] text-zinc-100 h-9 rounded-xl font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-blue-400" />
                Install Command
              </label>
              <Input
                value={installCommand}
                onChange={(e) => setInstallCommand(e.target.value)}
                placeholder="e.g. npm install"
                className="bg-[#121215] border-[#22222a] text-zinc-100 h-9 rounded-xl font-mono text-xs"
              />
            </div>

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
                  className="bg-[#121215] border-[#22222a] text-zinc-100 h-9 rounded-xl font-mono text-xs"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">Listen Port</label>
              <Input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="3000"
                className="bg-[#121215] border-[#22222a] text-zinc-100 h-9 rounded-xl font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">Root Directory</label>
              <Input
                value={sourceDir}
                onChange={(e) => setSourceDir(e.target.value)}
                placeholder="./"
                className="bg-[#121215] border-[#22222a] text-zinc-100 h-9 rounded-xl font-mono text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* Docker Compose Service Gateway Mapping */}
      {buildType === 'compose' && (
        <div className="space-y-4 pt-4 border-t border-[#1a1a22]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-zinc-200">Compose Ingress Service Mapping</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Map HTTP ingress routing to specific services defined in your compose file.
              </p>
            </div>
            <Button
              type="button"
              onClick={addComposeServiceRow}
              className="bg-[#1c1c24] hover:bg-[#262632] text-orange-400 text-xs border border-[#2e2e3c] w-full sm:w-auto"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Service
            </Button>
          </div>

          <div className="space-y-2">
            {composeServicesList.map((row) => (
              <div key={row.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#121215] border border-[#22222a]">
                <div>
                  <label className="block text-[10px] text-zinc-400 font-semibold mb-1">Service Name</label>
                  <Input
                    placeholder="e.g. web or api"
                    value={row.serviceName}
                    onChange={(e) => updateComposeServiceRow(row.id, 'serviceName', e.target.value)}
                    className="bg-[#181820] border-[#2a2a36] text-xs font-mono h-8"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 font-semibold mb-1">Container Port</label>
                  <Input
                    placeholder="e.g. 8000"
                    value={row.port}
                    onChange={(e) => updateComposeServiceRow(row.id, 'port', e.target.value)}
                    className="bg-[#181820] border-[#2a2a36] text-xs font-mono h-8"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] text-zinc-400 font-semibold mb-1">Subdomain Prefix</label>
                    <Input
                      placeholder="e.g. api (optional)"
                      value={row.subdomain}
                      onChange={(e) => updateComposeServiceRow(row.id, 'subdomain', e.target.value)}
                      className="bg-[#181820] border-[#2a2a36] text-xs font-mono h-8"
                    />
                  </div>
                  {composeServicesList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeComposeServiceRow(row.id)}
                      className="p-2 text-zinc-500 hover:text-red-400 shrink-0 mb-0.5"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
