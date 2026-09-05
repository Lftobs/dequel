import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { RepoPicker } from '../../github/RepoPicker';
import { GitBranch, Upload, FolderGit2, Link2, CheckCircle2, Lock } from 'lucide-react';
import type { GithubRepo } from '../../../types';
import { cn } from '../../../lib/utils';

interface SourceSelectionSectionProps {
  sourceType: 'git' | 'upload';
  setSourceType: (v: 'git' | 'upload') => void;
  selectedRepo: GithubRepo | null;
  onSelectRepo: (repo: GithubRepo | null) => void;
  repoUrl: string;
  setRepoUrl: (v: string) => void;
  repoBranch: string;
  setRepoBranch: (v: string) => void;
  showManualGit: boolean;
  setShowManualGit: (v: boolean) => void;
  githubConnected: boolean;
  githubConfigured: boolean;
  zipFile: File | null;
  setZipFile: (f: File | null) => void;
  onConnectGithub: () => void;
  onDisconnectGithub: () => void;
}

export function SourceSelectionSection({
  sourceType,
  setSourceType,
  selectedRepo,
  onSelectRepo,
  repoUrl,
  setRepoUrl,
  repoBranch,
  setRepoBranch,
  showManualGit,
  setShowManualGit,
  githubConnected,
  githubConfigured,
  zipFile,
  setZipFile,
  onConnectGithub,
  onDisconnectGithub,
}: SourceSelectionSectionProps) {
  const handleSourceTypeChange = (type: 'git' | 'upload') => {
    setSourceType(type);
    if (type === 'upload') {
      onSelectRepo(null);
      setRepoUrl('');
      setRepoBranch('');
    } else {
      setZipFile(null);
    }
  };

  return (
    <div className="space-y-6 bg-[#0d0d10] border border-[#1f1f26] p-5 sm:p-6 rounded-2xl shadow-lg">
      <div>
        <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <FolderGit2 className="h-4 w-4 text-orange-500" />
          Code Provider & Source
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Choose where your application source code is hosted or uploaded from.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => handleSourceTypeChange('git')}
          className={cn(
            'p-4 rounded-xl border text-left transition-all space-y-1.5',
            sourceType === 'git'
              ? 'bg-orange-500/10 border-orange-500/40 text-orange-400 ring-1 ring-orange-500/20'
              : 'bg-[#121215] border-[#22222a] text-zinc-400 hover:border-zinc-700'
          )}
        >
          <div className="flex items-center justify-between">
            <GitBranch className="h-5 w-5 text-orange-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500/20 text-orange-300">
              Git Repository
            </span>
          </div>
          <div className="font-bold text-xs text-zinc-100">Git Provider</div>
          <p className="text-[11px] text-zinc-400">
            Import from GitHub repositories or any public/private Git clone URL.
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleSourceTypeChange('upload')}
          className={cn(
            'p-4 rounded-xl border text-left transition-all space-y-1.5',
            sourceType === 'upload'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 ring-1 ring-emerald-500/20'
              : 'bg-[#121215] border-[#22222a] text-zinc-400 hover:border-zinc-700'
          )}
        >
          <div className="flex items-center justify-between">
            <Upload className="h-5 w-5 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              ZIP Upload
            </span>
          </div>
          <div className="font-bold text-xs text-zinc-100">Local Archive</div>
          <p className="text-[11px] text-zinc-400">
            Upload source code archive directly from your local computer.
          </p>
        </button>
      </div>

      {sourceType === 'git' && (
        <div className="space-y-4 pt-4 border-t border-[#1a1a22]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="text-xs font-semibold text-zinc-300">Repository Import Mode</label>
            <div className="flex items-center gap-1 bg-[#121215] p-1 rounded-xl border border-[#22222a] shrink-0">
              <button
                type="button"
                onClick={() => setShowManualGit(false)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5',
                  !showManualGit
                    ? 'bg-orange-500 text-white shadow-sm font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <FolderGit2 className="h-3.5 w-3.5" />
                GitHub Account
              </button>
              <button
                type="button"
                onClick={() => setShowManualGit(true)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5',
                  showManualGit
                    ? 'bg-orange-500 text-white shadow-sm font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <Link2 className="h-3.5 w-3.5" />
                Manual Git URL
              </button>
            </div>
          </div>

          {!showManualGit ? (
            <RepoPicker
              selected={selectedRepo}
              onSelect={onSelectRepo}
              onDisconnect={onDisconnectGithub}
              onConnect={onConnectGithub}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[#121215] border border-[#22222a]">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300">Git Clone URL *</label>
                <Input
                  placeholder="https://github.com/user/repository.git"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="bg-[#181820] border-[#2a2a36] text-xs font-mono text-zinc-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300">Branch (Optional)</label>
                <Input
                  placeholder="main"
                  value={repoBranch}
                  onChange={(e) => setRepoBranch(e.target.value)}
                  className="bg-[#181820] border-[#2a2a36] text-xs font-mono text-zinc-100"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {sourceType === 'upload' && (
        <div className="space-y-4 pt-4 border-t border-[#1a1a22]">
          <div className="p-6 border border-dashed border-[#2b2b36] rounded-xl bg-[#121215] text-center space-y-3">
            <Upload className="h-8 w-8 text-emerald-400 mx-auto" />
            <div>
              <p className="text-xs font-bold text-zinc-200">Upload Project Source Code (.zip)</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Ensure your repository root contains your app files or docker-compose.yml file.
              </p>
            </div>
            <input
              type="file"
              accept=".zip"
              onChange={(e) => setZipFile(e.target.files?.[0] || null)}
              className="hidden"
              id="zip-source-input"
            />
            <Button
              type="button"
              onClick={() => document.getElementById('zip-source-input')?.click()}
              className="bg-[#1c1c24] hover:bg-[#262632] text-zinc-200 text-xs border border-[#2e2e3c]"
            >
              Browse Local ZIP
            </Button>
            {zipFile && (
              <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-mono pt-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Selected: {zipFile.name} ({(zipFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
