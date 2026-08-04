import { useState, useEffect } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { useCreateProject } from '../hooks/useProjects';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';
import * as api from '../api/client';
import { getGithubIntegration } from '../api/client';
import type { GithubRepo } from '../types';
import { RepoPicker } from '../components/github/RepoPicker';
import { CreationStatusOverlay } from '../components/project/create/CreationStatusOverlay';
import {
  ArrowLeft,
  ArrowRight,
  GitBranch,
  Upload,
  Container,
  Sparkles,
  CheckCircle2,
  Key,
  Database,
  Plus,
  Trash2,
  Box,
  Server,
  FileText,
  Globe,
  Sliders,
  AlertCircle
} from 'lucide-react';

interface StagedEnv {
  key: string;
  value: string;
  environment?: string;
}

export function CreateProjectPage() {
  const navigate = useNavigate();
  const createProject = useCreateProject();

  const [step, setStep] = useState(1);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseDomain, setBaseDomain] = useState('');
  const [sourceType, setSourceType] = useState<'git' | 'upload'>('git');
  const [buildType, setBuildType] = useState<'railpack' | 'compose'>('railpack');

  // Git Settings
  const [repoUrl, setRepoUrl] = useState('');
  const [repoBranch, setRepoBranch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubConfigured, setGithubConfigured] = useState(false);
  const [showManualGit, setShowManualGit] = useState(false);

  // ZIP Settings
  const [zipFile, setZipFile] = useState<File | null>(null);

  // Build & Runtime Options (Railpack)
  const [projectType, setProjectType] = useState('web');
  const [port, setPort] = useState('');
  const [sourceDir, setSourceDir] = useState('');
  const [buildCommand, setBuildCommand] = useState('');
  const [startCommand, setStartCommand] = useState('');
  const [cpuLimit, setCpuLimit] = useState('');
  const [memoryLimitMb, setMemoryLimitMb] = useState('');

  // Docker Compose Settings
  const [composeServicesList, setComposeServicesList] = useState<{ id: string; serviceName: string; port: string; subdomain: string }[]>([
    { id: '1', serviceName: '', port: '', subdomain: '' }
  ]);

  const addComposeServiceRow = () => {
    setComposeServicesList((prev) => [
      ...prev,
      { id: String(Date.now()), serviceName: '', port: '', subdomain: '' }
    ]);
  };

  const removeComposeServiceRow = (id: string) => {
    if (composeServicesList.length <= 1) return;
    setComposeServicesList((prev) => prev.filter((item) => item.id !== id));
  };

  const updateComposeServiceRow = (id: string, field: 'serviceName' | 'port' | 'subdomain', value: string) => {
    setComposeServicesList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Environment Variables State & Tabs
  const [stagedEnvs, setStagedEnvs] = useState<StagedEnv[]>([]);
  const [envTab, setEnvTab] = useState<'single' | 'bulk' | 'file'>('single');
  const [singleKey, setSingleKey] = useState('');
  const [singleVal, setSingleVal] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [fileError, setFileError] = useState('');

  // Provision Database State & Version Selection
  const [provisionDb, setProvisionDb] = useState(false);
  const [dbType, setDbType] = useState<'postgresql' | 'mysql'>('postgresql');
  const [dbVersion, setDbVersion] = useState('16-alpine');
  const [dbCpu, setDbCpu] = useState('');
  const [dbMemory, setDbMemory] = useState('');

  // Status
  const [submittingStatus, setSubmittingStatus] = useState<
    'idle' | 'creating_project' | 'creating_envs' | 'creating_db' | 'done' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    getGithubIntegration()
      .then((status) => {
        if ((status as any).configured) {
          setGithubConfigured(true);
          api.getGithubUser()
            .then(() => setGithubConnected(true))
            .catch(() => {});
        } else {
          setGithubConfigured(false);
        }
      })
      .catch(() => {});
  }, []);

  // Update default version when database engine changes
  useEffect(() => {
    if (dbType === 'postgresql') {
      setDbVersion('16-alpine');
    } else {
      setDbVersion('8.0');
    }
  }, [dbType]);

  // Env Parsing helper
  const parseEnvText = (text: string): StagedEnv[] => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    const result: StagedEnv[] = [];
    for (const line of lines) {
      const idx = line.indexOf('=');
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!key) continue;
      result.push({ key, value, environment: 'production' });
    }
    return result;
  };

  const handleAddSingleEnv = () => {
    if (!singleKey.trim() || !singleVal.trim()) return;
    setStagedEnvs((prev) => {
      const next = [...prev];
      const idx = next.findIndex((x) => x.key === singleKey.trim());
      if (idx >= 0) {
        next[idx] = { key: singleKey.trim(), value: singleVal.trim(), environment: 'production' };
      } else {
        next.push({ key: singleKey.trim(), value: singleVal.trim(), environment: 'production' });
      }
      return next;
    });
    setSingleKey('');
    setSingleVal('');
  };

  const handleBulkImport = () => {
    const parsed = parseEnvText(bulkText);
    if (parsed.length === 0) {
      setFileError('No valid KEY=VALUE pairs found in text.');
      return;
    }
    setStagedEnvs((prev) => {
      const next = [...prev];
      for (const item of parsed) {
        const idx = next.findIndex((x) => x.key === item.key);
        if (idx >= 0) {
          next[idx] = item;
        } else {
          next.push(item);
        }
      }
      return next;
    });
    setBulkText('');
    setFileError('');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseEnvText(text);
      if (parsed.length === 0) {
        setFileError('No valid KEY=VALUE pairs found in file.');
        return;
      }
      setStagedEnvs((prev) => {
        const next = [...prev];
        for (const item of parsed) {
          const idx = next.findIndex((x) => x.key === item.key);
          if (idx >= 0) {
            next[idx] = item;
          } else {
            next.push(item);
          }
        }
        return next;
      });
      setFileError('');
    } catch {
      setFileError('Failed to read file.');
    }
  };

  const handleRemoveEnv = (index: number) => {
    setStagedEnvs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!name.trim()) return;

    setSubmittingStatus('creating_project');
    setErrorMessage('');

    let project: any = null;

    try {
      const payload: any = {
        name: name.trim(),
        description: description.trim() || undefined,
        baseDomain: baseDomain.trim() || undefined,
        repoUrl: repoUrl.trim() || undefined,
        repoBranch: repoBranch.trim() || undefined,
        port: port.trim() ? Number(port) || null : undefined,
        sourceDir: sourceDir.trim() || undefined,
        sourceType,
        projectType,
        buildType,
        buildCommand: buildCommand.trim() || undefined,
        startCommand: startCommand.trim() || undefined,
        cpuLimit: cpuLimit.trim() ? Number(cpuLimit) || null : undefined,
        memoryLimitMb: memoryLimitMb.trim() ? Number(memoryLimitMb) || null : undefined,
      };

      if (buildType === 'compose') {
        payload.composeService = composeServicesList[0]?.serviceName.trim() || undefined;
        payload.composePort = composeServicesList[0]?.port.trim() ? Number(composeServicesList[0].port) || null : undefined;
        payload.composeServices = JSON.stringify(composeServicesList);
      }

      project = await createProject.mutateAsync(payload);

      if (zipFile && sourceType === 'upload') {
        const form = new FormData();
        form.append('sourceType', 'upload');
        form.append('projectId', project.id);
        form.append('archive', zipFile);
        await api.createDeployment(form);
      } else if (sourceType === 'git' && repoUrl.trim()) {
        const form = new FormData();
        form.append('sourceType', 'git');
        form.append('projectId', project.id);
        form.append('gitUrl', repoUrl.trim());
        if (repoBranch.trim()) form.append('branch', repoBranch.trim());
        await api.createDeployment(form);
      }

      if (stagedEnvs.length > 0) {
        setSubmittingStatus('creating_envs');
        await Promise.all(
          stagedEnvs.map((env) =>
            api.createEnvVar(project.id, {
              key: env.key.trim(),
              value: env.value.trim(),
              environment: env.environment || 'production',
            })
          )
        );
      }

      if (provisionDb) {
        setSubmittingStatus('creating_db');
        await api.createDatabase(project.id, dbType, {
          version: dbVersion.trim() || undefined,
          cpuLimit: dbCpu.trim() ? Number(dbCpu) : null,
          memoryLimitMb: dbMemory.trim() ? Number(dbMemory) : null,
        });
      }

      setSubmittingStatus('done');

      setTimeout(() => {
        navigate({ to: '/project/$projectId', params: { projectId: project.id } });
      }, 1200);
    } catch (err: any) {
      if (project) {
        api.deleteProject(project.id).catch(() => {});
      }
      console.error(err);
      setErrorMessage(err.message || 'An unexpected error occurred during project creation.');
      setSubmittingStatus('error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#1c1c21] pb-5">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="w-9 h-9 rounded-xl bg-[#0c0c0e] border border-[#1c1c21] flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
              Create New Project
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">Deploy web applications, APIs, or multi-container stacks.</p>
          </div>
        </div>

        {/* Stepper indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => s < step && setStep(s)}
              className={cn(
                'w-8 h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center',
                step === s
                  ? 'bg-amber-500 text-white font-mono shadow-lg shadow-amber-500/20'
                  : s < step
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-[#121215] text-zinc-600 border border-[#1c1c21]'
              )}
            >
              {s < step ? <CheckCircle2 className="h-4 w-4" /> : s}
            </button>
          ))}
        </div>
      </div>

      {submittingStatus !== 'idle' ? (
        <CreationStatusOverlay
          submittingStatus={submittingStatus}
          errorMessage={errorMessage}
          hasEnvs={stagedEnvs.length > 0}
          hasDb={provisionDb}
          dbType={dbType}
          onRetry={() => setSubmittingStatus('idle')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Content */}
          <div className="lg:col-span-8 space-y-6">
            {/* STEP 1: General & Source */}
            {step === 1 && (
              <div className="space-y-6 bg-[#0c0c0e] border border-[#1c1c21] p-6 rounded-2xl">
                <div>
                  <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    1. Identity & Source
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">Name your project, set your domain, and connect code.</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Project Name *</label>
                      <Input
                        placeholder="my-awesome-app"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-[#121215] border-[#222227] text-zinc-200 text-xs h-10 focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Description (Optional)</label>
                      <Input
                        placeholder="Short summary of this service..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="bg-[#121215] border-[#222227] text-zinc-200 text-xs h-10 focus:border-orange-500"
                      />
                    </div>
                  </div>

                  {/* Code Provider Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-2">Code Provider</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSourceType('git')}
                        className={cn(
                          'p-4 rounded-xl border text-left transition-all flex items-start gap-3',
                          sourceType === 'git'
                            ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
                            : 'bg-[#121215] border-[#1c1c21] text-zinc-400 hover:border-zinc-700'
                        )}
                      >
                        <GitBranch className="h-5 w-5 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-zinc-200">Git Repository</div>
                          <div className="text-[11px] text-zinc-500 mt-0.5">Deploy from GitHub or Git URL</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSourceType('upload')}
                        className={cn(
                          'p-4 rounded-xl border text-left transition-all flex items-start gap-3',
                          sourceType === 'upload'
                            ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
                            : 'bg-[#121215] border-[#1c1c21] text-zinc-400 hover:border-zinc-700'
                        )}
                      >
                        <Upload className="h-5 w-5 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-zinc-200">ZIP Archive</div>
                          <div className="text-[11px] text-zinc-500 mt-0.5">Upload source code ZIP directly</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Git Fields & RepoPicker */}
                  {sourceType === 'git' && (
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between border-b border-[#1c1c21] pb-2">
                        <span className="text-xs font-semibold text-zinc-300">Repository Selection</span>
                        <div className="flex items-center gap-1 bg-[#121215] p-1 rounded-lg border border-[#1c1c21]">
                          <button
                            type="button"
                            onClick={() => setShowManualGit(false)}
                            className={cn(
                              'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all',
                              !showManualGit ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-zinc-200'
                            )}
                          >
                            GitHub Repos
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowManualGit(true)}
                            className={cn(
                              'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all',
                              showManualGit ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-zinc-200'
                            )}
                          >
                            Manual URL
                          </button>
                        </div>
                      </div>

                      {!showManualGit ? (
                        <RepoPicker
                          selected={selectedRepo}
                          onSelect={(repo) => {
                            setSelectedRepo(repo);
                            if (repo) {
                              setRepoUrl(repo.clone_url);
                              setRepoBranch(repo.default_branch);
                              if (!name) setName(repo.name);
                            }
                          }}
                          onDisconnect={() => setGithubConnected(false)}
                        />
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1">Git Repository URL</label>
                            <Input
                              placeholder="https://github.com/user/repo.git"
                              value={repoUrl}
                              onChange={(e) => setRepoUrl(e.target.value)}
                              className="bg-[#121215] border-[#222227] text-zinc-200 text-xs h-10 font-mono focus:border-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1">Branch (Optional)</label>
                            <Input
                              placeholder="main"
                              value={repoBranch}
                              onChange={(e) => setRepoBranch(e.target.value)}
                              className="bg-[#121215] border-[#222227] text-zinc-200 text-xs h-10 font-mono focus:border-orange-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Upload Field */}
                  {sourceType === 'upload' && (
                    <div className="pt-2">
                      <label className="block text-xs font-medium text-zinc-400 mb-2">ZIP File</label>
                      <input
                        type="file"
                        accept=".zip"
                        onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                        className="block w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-500/10 file:text-orange-400 hover:file:bg-orange-500/20 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: Build & Runtime Strategy */}
            {step === 2 && (
              <div className="space-y-6 bg-[#0c0c0e] border border-[#1c1c21] p-6 rounded-2xl">
                <div>
                  <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                    <Container className="h-4 w-4 text-orange-500" />
                    2. Build & Runtime Strategy
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">Select how Dequel builds and manages your containers.</p>
                </div>

                {/* Build Type Card Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setBuildType('railpack')}
                    className={cn(
                      'p-5 rounded-xl border text-left transition-all space-y-2',
                      buildType === 'railpack'
                        ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
                        : 'bg-[#121215] border-[#1c1c21] text-zinc-400 hover:border-zinc-700'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <Box className="h-6 w-6 text-orange-500" />
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500/20 text-orange-300">
                        Default
                      </span>
                    </div>
                    <div className="font-bold text-sm text-zinc-100">Railpack Engine</div>
                    <p className="text-xs text-zinc-500">
                      Zero-config auto-detection for Node.js, Go, Python, Rust, Astro, Next.js, etc. Builds a single container.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBuildType('compose')}
                    className={cn(
                      'p-5 rounded-xl border text-left transition-all space-y-2',
                      buildType === 'compose'
                        ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
                        : 'bg-[#121215] border-[#1c1c21] text-zinc-400 hover:border-zinc-700'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <Container className="h-6 w-6 text-orange-500" />
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500/20 text-orange-300">
                        Multi-Container
                      </span>
                    </div>
                    <div className="font-bold text-sm text-zinc-100">Docker Compose</div>
                    <p className="text-xs text-zinc-500">
                      Build and deploy multi-service applications using a docker-compose.yml file.
                    </p>
                  </button>
                </div>

                {/* Specific Config based on Build Type */}
                {buildType === 'railpack' ? (
                  <div className="space-y-4 pt-4 border-t border-[#1c1c21]">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Application Port</label>
                        <Input
                          placeholder="e.g. 3000"
                          value={port}
                          onChange={(e) => setPort(e.target.value)}
                          className="bg-[#121215] border-[#222227] text-zinc-200 text-xs h-10 focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Root Subdirectory</label>
                        <Input
                          placeholder="e.g. apps/web"
                          value={sourceDir}
                          onChange={(e) => setSourceDir(e.target.value)}
                          className="bg-[#121215] border-[#222227] text-zinc-200 text-xs h-10 focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Build Command (Optional)</label>
                        <Input
                          placeholder="npm run build"
                          value={buildCommand}
                          onChange={(e) => setBuildCommand(e.target.value)}
                          className="bg-[#121215] border-[#222227] text-zinc-200 text-xs h-10 font-mono focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Start Command (Optional)</label>
                        <Input
                          placeholder="npm start"
                          value={startCommand}
                          onChange={(e) => setStartCommand(e.target.value)}
                          className="bg-[#121215] border-[#222227] text-zinc-200 text-xs h-10 font-mono focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Compose Settings */
                  <div className="space-y-4 pt-4 border-t border-[#1c1c21]">
                    <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20 text-xs text-orange-300 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <Container className="h-4 w-4" /> Docker Compose Services
                      </div>
                      <p className="text-zinc-400">
                        Bind your docker-compose services to preferred subdomains (e.g. Service: <code className="text-orange-400">server</code>, Port: <code className="text-orange-400">3001</code>, Preferred Subdomain: <code className="text-orange-400">api</code> points <code className="text-orange-400">api.&lt;projectliveurl&gt;</code> to <code className="text-orange-400">server:3001</code>).
                      </p>
                    </div>

                    <div className="space-y-3">
                      {composeServicesList.map((item, index) => (
                        <div key={item.id} className="p-3.5 rounded-xl bg-[#121215] border border-[#222227] space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-orange-500 uppercase tracking-wider">
                                Service #{index + 1}
                              </span>
                              {index === 0 && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40 uppercase tracking-wider flex items-center gap-1">
                                  <Sparkles className="h-3 w-3 text-orange-400" /> ENTRY
                                </span>
                              )}
                            </div>
                            {composeServicesList.length > 1 && index > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeComposeServiceRow(item.id)}
                                className="h-7 text-xs text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 px-2 rounded-lg"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                                Service Name
                              </label>
                              <Input
                                placeholder="e.g. server or web"
                                value={item.serviceName}
                                onChange={(e) => updateComposeServiceRow(item.id, 'serviceName', e.target.value)}
                                className="bg-[#0c0c0e] border-[#222227] text-zinc-200 text-xs h-9 font-mono focus:border-orange-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                                Service Port
                              </label>
                              <Input
                                placeholder="e.g. 3001 or 8080"
                                type="number"
                                value={item.port}
                                onChange={(e) => updateComposeServiceRow(item.id, 'port', e.target.value)}
                                className="bg-[#0c0c0e] border-[#222227] text-zinc-200 text-xs h-9 font-mono focus:border-orange-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                                Preferred Subdomain
                              </label>
                              {index === 0 ? (
                                <div className="flex items-center gap-1.5 h-9 px-3 bg-[#0c0c0e]/80 border border-[#222227] rounded-lg text-xs text-zinc-400 font-mono">
                                  <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-bold">ENTRY</span>
                                  <span className="text-zinc-500 text-[11px]">Primary Project Domain</span>
                                </div>
                              ) : (
                                <Input
                                  placeholder="e.g. api"
                                  value={item.subdomain}
                                  onChange={(e) => updateComposeServiceRow(item.id, 'subdomain', e.target.value)}
                                  className="bg-[#0c0c0e] border-[#222227] text-zinc-200 text-xs h-9 font-mono focus:border-orange-500"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      <Button
                        type="button"
                        onClick={addComposeServiceRow}
                        variant="outline"
                        className="w-full bg-[#0c0c0e] border-dashed border-[#222227] hover:border-orange-500/50 text-xs text-zinc-400 hover:text-zinc-200 font-semibold flex items-center justify-center gap-1.5 h-9 rounded-xl transition-all"
                      >
                        <Plus className="h-3.5 w-3.5 text-orange-500" /> Add Another Service Mapping
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Environment Variables & Database */}
            {step === 3 && (
              <div className="space-y-6 bg-[#0c0c0e] border border-[#1c1c21] p-6 rounded-2xl">
                <div>
                  <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                    <Key className="h-4 w-4 text-orange-500" />
                    3. Environment Variables & Database
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">Configure secrets and optionally provision a managed database.</p>
                </div>

                {/* Env Vars Section */}
                <div className="space-y-4 bg-[#121215] border border-[#1c1c21] p-5 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-zinc-200">Environment Variables</h3>
                      <p className="text-[11px] text-zinc-500">Inject build & runtime secrets into your containers.</p>
                    </div>
                    <div className="flex items-center gap-1 bg-[#0c0c0e] p-1 rounded-lg border border-[#1c1c21]">
                      <button
                        type="button"
                        onClick={() => setEnvTab('single')}
                        className={cn(
                          'px-3 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1',
                          envTab === 'single' ? 'bg-orange-500 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                        )}
                      >
                        <Plus className="h-3 w-3" /> Key-Value
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnvTab('bulk')}
                        className={cn(
                          'px-3 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1',
                          envTab === 'bulk' ? 'bg-orange-500 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                        )}
                      >
                        <FileText className="h-3 w-3" /> Bulk Text
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnvTab('file')}
                        className={cn(
                          'px-3 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1',
                          envTab === 'file' ? 'bg-orange-500 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                        )}
                      >
                        <Upload className="h-3 w-3" /> .env File
                      </button>
                    </div>
                  </div>

                  {envTab === 'single' && (
                    <div className="flex gap-2 pt-2">
                      <Input
                        placeholder="KEY (e.g. DATABASE_URL)"
                        value={singleKey}
                        onChange={(e) => setSingleKey(e.target.value)}
                        className="bg-[#0c0c0e] border-[#222227] text-zinc-200 text-xs h-9 flex-1 font-mono focus:border-orange-500"
                      />
                      <Input
                        placeholder="VALUE"
                        value={singleVal}
                        onChange={(e) => setSingleVal(e.target.value)}
                        className="bg-[#0c0c0e] border-[#222227] text-zinc-200 text-xs h-9 flex-1 font-mono focus:border-orange-500"
                      />
                      <Button
                        onClick={handleAddSingleEnv}
                        type="button"
                        className="bg-orange-500 hover:bg-orange-600 text-white h-9 px-4 text-xs font-semibold rounded-lg transition-all shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Variable
                      </Button>
                    </div>
                  )}

                  {envTab === 'bulk' && (
                    <div className="space-y-3 pt-2">
                      <textarea
                        placeholder={`DATABASE_URL=postgres://user:pass@host:5432/db\nPORT=3000\nAPI_KEY="sk_live_12345"`}
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        rows={5}
                        className="w-full bg-[#0c0c0e] border border-[#222227] rounded-xl p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-orange-500"
                      />
                      <Button
                        onClick={handleBulkImport}
                        type="button"
                        className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-9 px-4 font-semibold rounded-lg transition-all"
                      >
                        Import Variables
                      </Button>
                    </div>
                  )}

                  {envTab === 'file' && (
                    <div className="pt-2">
                      <label className="border-2 border-dashed border-[#222227] hover:border-orange-500/50 bg-[#0c0c0e] rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all">
                        <Upload className="h-6 w-6 text-orange-500 mb-2" />
                        <span className="text-xs font-semibold text-zinc-300">Click to upload or drag & drop .env file</span>
                        <span className="text-[11px] text-zinc-500 mt-0.5">Supports .env, .env.local, .env.production</span>
                        <input
                          type="file"
                          accept=".env,.env.*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  {fileError && (
                    <div className="text-xs text-rose-400 flex items-center gap-1.5 pt-1">
                      <AlertCircle className="h-3.5 w-3.5" /> {fileError}
                    </div>
                  )}

                  {/* Staged Env List */}
                  {stagedEnvs.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-[#1c1c21]">
                      <div className="text-[11px] font-semibold text-zinc-400 flex items-center justify-between">
                        <span>Staged Variables ({stagedEnvs.length})</span>
                        <button
                          type="button"
                          onClick={() => setStagedEnvs([])}
                          className="text-zinc-500 hover:text-rose-400 text-[10px]"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {stagedEnvs.map((env, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-[#0c0c0e] border border-[#1c1c21] text-xs font-mono"
                          >
                            <span className="text-orange-400 font-bold">{env.key}</span>
                            <span className="text-zinc-500">••••••••</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveEnv(idx)}
                              className="text-zinc-500 hover:text-rose-400 transition-colors p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Managed Database Selection Cards */}
                <div className="pt-4 border-t border-[#1c1c21] space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#121215] border border-[#1c1c21]">
                    <div>
                      <div className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                        <Database className="h-4 w-4 text-emerald-500" /> Provision Managed Database
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">Spin up an attached database container instance.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProvisionDb(!provisionDb)}
                      className={cn(
                        'w-11 h-6 rounded-full transition-colors relative focus:outline-none',
                        provisionDb ? 'bg-orange-500' : 'bg-[#222227]'
                      )}
                    >
                      <span
                        className={cn(
                          'w-4 h-4 rounded-full bg-white block absolute top-1 transition-transform',
                          provisionDb ? 'left-6' : 'left-1'
                        )}
                      />
                    </button>
                  </div>

                  {provisionDb && (
                    <div className="p-5 rounded-xl bg-[#121215] border border-[#1c1c21] space-y-4">
                      <label className="block text-xs font-semibold text-zinc-300">Select Database Engine</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setDbType('postgresql')}
                          className={cn(
                            'p-4 rounded-xl border text-left transition-all space-y-2',
                            dbType === 'postgresql'
                              ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
                              : 'bg-[#0c0c0e] border-[#1c1c21] text-zinc-400 hover:border-zinc-700'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <Database className="h-5 w-5 text-emerald-400" />
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                              PostgreSQL
                            </span>
                          </div>
                          <div className="font-bold text-xs text-zinc-100">PostgreSQL 16</div>
                          <p className="text-[11px] text-zinc-500">Powerful relational database for modern applications.</p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDbType('mysql')}
                          className={cn(
                            'p-4 rounded-xl border text-left transition-all space-y-2',
                            dbType === 'mysql'
                              ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
                              : 'bg-[#0c0c0e] border-[#1c1c21] text-zinc-400 hover:border-zinc-700'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <Database className="h-5 w-5 text-blue-400" />
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                              MySQL
                            </span>
                          </div>
                          <div className="font-bold text-xs text-zinc-100">MySQL 8.0</div>
                          <p className="text-[11px] text-zinc-500">Fast, reliable open-source relational database.</p>
                        </button>
                      </div>

                      <div className="pt-2">
                        <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Version Tag</label>
                        <select
                          value={dbVersion}
                          onChange={(e) => setDbVersion(e.target.value)}
                          className="w-full bg-[#0c0c0e] border border-[#222227] rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-orange-500"
                        >
                          {dbType === 'postgresql' ? (
                            <>
                              <option value="16-alpine">16-alpine (Recommended)</option>
                              <option value="15-alpine">15-alpine</option>
                              <option value="14-alpine">14-alpine</option>
                              <option value="16">16 (latest)</option>
                            </>
                          ) : (
                            <>
                              <option value="8.0">8.0 (Recommended)</option>
                              <option value="8.4">8.4 (LTS)</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: Summary & Launch */}
            {step === 4 && (
              <div className="space-y-6 bg-[#0c0c0e] border border-[#1c1c21] p-6 rounded-2xl">
                <div>
                  <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    4. Ready to Deploy
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">Review your configuration before launching your service.</p>
                </div>

                <div className="space-y-3 bg-[#121215] border border-[#1c1c21] p-4 rounded-xl text-xs space-y-2">
                  <div className="flex justify-between py-1 border-b border-[#1c1c21]">
                    <span className="text-zinc-500">Project Name:</span>
                    <span className="font-bold text-zinc-200">{name}</span>
                  </div>
                  {baseDomain && (
                    <div className="flex justify-between py-1 border-b border-[#1c1c21]">
                      <span className="text-zinc-500">Subdomain / Base Domain:</span>
                      <span className="font-mono text-amber-400">{baseDomain}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-[#1c1c21]">
                    <span className="text-zinc-500">Code Provider:</span>
                    <span className="font-bold text-amber-400 uppercase">{sourceType}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#1c1c21]">
                    <span className="text-zinc-500">Build Strategy:</span>
                    <span className="font-bold text-rose-400 uppercase">{buildType}</span>
                  </div>
                  {buildType === 'compose' && (
                    <div className="flex justify-between py-1 border-b border-[#1c1c21]">
                      <span className="text-zinc-500">Compose Ingress:</span>
                      <span className="font-mono text-zinc-300">
                        {composeServicesList[0]?.serviceName.trim() || 'Auto-detect'} : {composeServicesList[0]?.port.trim() || 'Auto-detect'}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-[#1c1c21]">
                    <span className="text-zinc-500">Environment Vars:</span>
                    <span className="font-mono text-zinc-300">{stagedEnvs.length} variables</span>
                  </div>
                  {provisionDb && (
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-500">Managed Database:</span>
                      <span className="font-mono text-emerald-400 uppercase">
                        {dbType} ({dbVersion})
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={handleCreate}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold h-11 text-xs rounded-xl shadow-lg shadow-orange-500/20"
                >
                  <Sparkles className="h-4 w-4 mr-2" /> Launch Deployment
                </Button>
              </div>
            )}

            {/* Stepper Control Buttons */}
            <div className="flex items-center justify-between pt-2">
              {step > 1 ? (
                <Button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="bg-[#121215] border border-[#1c1c21] hover:bg-[#18181c] text-zinc-400 text-xs h-10 px-5 rounded-xl"
                >
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                </Button>
              ) : <div />}

              {step < 4 && (
                <Button
                  type="button"
                  disabled={step === 1 && !name.trim()}
                  onClick={() => setStep((s) => s + 1)}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-10 px-6 rounded-xl font-bold ml-auto shadow-md shadow-orange-500/10"
                >
                  Continue <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Right Column: Live Summary Card */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[#0c0c0e] border border-[#1c1c21] p-5 rounded-2xl space-y-4 sticky top-6">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="h-4 w-4 text-amber-500" /> Deployment Summary
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-[#121215] border border-[#1c1c21] space-y-1">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">Name</div>
                  <div className="font-bold text-zinc-200 font-mono">{name || '—'}</div>
                </div>

                {baseDomain && (
                  <div className="p-3 rounded-xl bg-[#121215] border border-[#1c1c21] space-y-1">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase">Domain</div>
                    <div className="font-bold text-amber-400 font-mono text-[11px] truncate">{baseDomain}</div>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-[#121215] border border-[#1c1c21] space-y-1">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">Build Strategy</div>
                  <div className="font-bold text-amber-400 uppercase">{buildType}</div>
                </div>

                {buildType === 'compose' ? (
                  <div className="p-3 rounded-xl bg-[#121215] border border-[#1c1c21] space-y-1">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase">Compose Gateway</div>
                    <div className="text-zinc-300 font-mono text-[11px]">
                      {composeServicesList[0]?.serviceName.trim() || 'Auto-detect'} {composeServicesList[0]?.port.trim() ? `:${composeServicesList[0].port.trim()}` : ''}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[#121215] border border-[#1c1c21] space-y-1">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase">Port</div>
                    <div className="text-zinc-300 font-mono text-[11px]">{port || 'Auto (3000)'}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
