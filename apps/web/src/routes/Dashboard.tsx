import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useProjects, useDeleteProject } from '../hooks/useProjects';
import { useQuery } from '@tanstack/react-query';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { formatUptime, parseMetrics } from '../lib/metrics';
import { cn } from '../lib/utils';
import { CreateProjectDialog } from '../components/project/create/CreateProjectDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../components/ui/dialog';
import {
  Plus,
  FolderKanban,
  Trash2,
  Globe,
  GitBranch,
  Activity,
  Server,
  Clock,
  Search,
  Filter,
  Layers,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Laptop
} from 'lucide-react';
import * as api from '../api/client';

function formatTimeAgo(dateString?: string) {
  if (!dateString) return '—';
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function Dashboard() {
  const { data: projects = [], isLoading } = useProjects();
  const deleteProject = useDeleteProject();

  // Search and view filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);

  // Fetch metrics
  const { data: metricsText, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => api.getMetrics(),
    refetchInterval: 10000,
  });

  // Fetch all recent deployments for the "Recent Previews" component
  const { data: allDeploymentsData, isLoading: deploymentsLoading } = useQuery({
    queryKey: ['all-deployments'],
    queryFn: () => api.listDeployments(),
    refetchInterval: 10000,
  });
  const allDeployments = allDeploymentsData?.items ?? [];

  const metrics = metricsText ? parseMetrics(metricsText) : null;

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-zinc-500 text-xs tracking-wider uppercase">Loading Workspace Projects...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      
      {/* Header section with page title & New Project button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#1c1c21]">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            Overview
          </h1>
          <p className="text-zinc-500 text-xs mt-1">Manage, deploy and monitor your workspace cluster services.</p>
        </div>
        <div className="flex items-center gap-3">
          <CreateProjectDialog open={open} onOpenChange={setOpen} />
        </div>
      </div>

      {/* Two Column Layout: Left Column (Stats/Previews) & Right Column (Projects) */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Left Side: Stats/Recent Previews */}
        <div className="w-full lg:w-[320px] shrink-0 space-y-6">
          
          {/* Usage Metrics Panel */}
          <div className="rounded-xl border border-[#1c1c21] bg-[#0c0c0e] p-5 space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-amber-500" />
              Node Allocation
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>API Traffic / Capacity</span>
                  <span className="text-zinc-300 font-mono font-medium">{metricsLoading ? '...' : (metrics?.requestsTotal ?? 0)} reqs</span>
                </div>
                <div className="w-full bg-[#18181b] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(((metrics?.requestsTotal ?? 0) / 1500) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Active Deployments</span>
                  <span className="text-zinc-300 font-mono font-medium">{metricsLoading ? '...' : (metrics?.activeDeployments ?? 0)} running</span>
                </div>
                <div className="w-full bg-[#18181b] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(((metrics?.activeDeployments ?? 0) / 10) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Cluster Ingress Uptime</span>
                  <span className="text-zinc-300 font-mono font-medium">{metricsLoading ? '...' : formatUptime(metrics?.uptimeSeconds)}</span>
                </div>
                <div className="w-full bg-[#18181b] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: metrics?.uptimeSeconds ? '100%' : '0%' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Anomaly Alerts Pro Callout Box */}
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-rose-500/5 p-5 space-y-3 relative overflow-hidden group">
            <div className="absolute right-4 bottom-4 opacity-5 group-hover:scale-125 transition-transform duration-300">
              <Sparkles className="h-16 w-16 text-amber-500" />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <AlertCircle className="h-4 w-4" />
              Get Alerted For Anomalies
            </div>
            <p className="text-xs text-zinc-400 leading-normal">
              Automatically monitor container memory leaks and network request latency spikes.
            </p>
            <Button className="w-full bg-[#141418] border border-[#222227] hover:bg-[#1a1a21] hover:border-[#33333b] text-zinc-300 hover:text-white text-xs h-8 rounded-lg shadow-sm">
              Upgrade to Pro
            </Button>
          </div>

          {/* Recent Previews List */}
          <div className="rounded-xl border border-[#1c1c21] bg-[#0c0c0e] p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-rose-500" />
              Recent Previews
            </h3>

            {deploymentsLoading ? (
              <div className="text-zinc-600 text-xs py-4 text-center">Loading Previews...</div>
            ) : allDeployments.length === 0 ? (
              <div className="text-zinc-600 text-xs py-4 text-center">No recent builds.</div>
            ) : (
              <div className="space-y-3.5">
                {allDeployments
                  .filter(dep => dep.status === 'running' && dep.projectId && projects.some(p => p.id === dep.projectId))
                  .slice(0, 5)
                  .map(dep => {
                    const project = projects.find(p => p.id === dep.projectId);
                    return (
                      <Link
                        key={dep.id}
                        to="/project/$projectId"
                        params={{ projectId: dep.projectId || '' }}
                      search={{ tab: 'deployments' }}
                      className="block group/preview border-b border-[#18181c] pb-3 last:border-0 last:pb-0"
                    >
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-zinc-300 truncate max-w-[130px] group-hover/preview:text-amber-400 transition-colors">
                            {project ? project.name : 'Unknown Project'}
                          </span>
                          <span className="text-[10px] text-zinc-500 shrink-0 font-mono">
                            {formatTimeAgo(dep.createdAt)}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 truncate font-mono">
                          {dep.branch ? `branch: ${dep.branch}` : 'file upload'}
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 font-mono scale-95 origin-left">
                            {dep.id.slice(0, 8)}
                          </span>
                          <StatusBadge status={dep.status} />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Search bar & Projects Grid */}
        <div className="flex-1 w-full space-y-6">
          
          {/* Controls: Search, Layout Filter Toggle */}
          <div className="flex items-center gap-3 w-full bg-[#0c0c0e] border border-[#1c1c21] p-3 rounded-xl">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent border-0 ring-0 focus:ring-0 focus:ring-offset-0 text-xs pl-9 placeholder-zinc-500 h-9 w-full shadow-none text-zinc-200"
              />
            </div>
            <div className="h-4 w-[1px] bg-[#1a1a1f]" />
            <span className="hidden sm:inline text-[10px] text-zinc-500 font-mono bg-zinc-850 px-2 py-1 rounded border border-[#222227] select-none">
              ⌘K
            </span>
          </div>

          {/* Project List / Grid */}
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-[#222227] bg-[#0c0c0e]/30">
              <div className="w-12 h-12 rounded-2xl bg-[#0c0c0e] border border-[#222227] flex items-center justify-center mb-4">
                <FolderKanban className="h-6 w-6 text-zinc-650" />
              </div>
              <h3 className="font-semibold text-zinc-300 text-sm mb-1">No Projects Found</h3>
              <p className="text-zinc-500 text-xs max-w-xs mb-4">
                Create a new project deployment to see container orchestration on the cluster.
              </p>
              <Button onClick={() => setOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-white text-xs h-8 rounded-lg">
                <Plus className="h-3.5 w-3.5 mr-1" />New Project
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredProjects.map(project => (
                <ProjectGridCard
                  key={project.id}
                  project={project}
                  onDelete={() => deleteProject.mutate(project.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectGridCard({ project, onDelete }: { project: any; onDelete: () => void }) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Query to get the latest deployment for this project
  const { data: deploymentsData } = useQuery({
    queryKey: ['deployments-preview', project.id],
    queryFn: () => api.listDeployments(project.id),
    refetchInterval: 10000,
  });
  const deployments = deploymentsData?.items ?? [];

  const latest = deployments[0];
  const runningCount = deployments.filter(d => d.status === 'running').length;

  return (
    <>
      <Link
        to="/project/$projectId"
        params={{ projectId: project.id }}
        search={{ tab: 'deployments' } as any}
        className="block group relative rounded-xl border border-[#1a1a1f] bg-[#0c0c0e] hover:border-amber-500/20 hover:shadow-xl hover:shadow-amber-500/[0.02] transition-all duration-300 overflow-hidden"
      >
        
        {/* Top Background Gradient Highlight */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/0 to-transparent group-hover:via-amber-500/20 transition-all duration-500" />
        
        {/* Delete button shown only on card hover */}
        <button
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 transition-all duration-200 z-10"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            setIsDeleteOpen(true);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

      <div className="p-5 space-y-4">
        
        {/* Project Header Info */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-display font-black text-sm shrink-0 shadow-inner text-zinc-200 group-hover:border-amber-500/20 transition-colors">
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 pr-6">
            <h3 className="font-bold text-zinc-200 text-sm truncate group-hover:text-zinc-100 transition-colors">
              {project.name}
            </h3>
            {project.description ? (
              <p className="text-zinc-500 text-xs truncate mt-0.5">{project.description}</p>
            ) : (
              <p className="text-zinc-650 text-xs italic mt-0.5">No description provided</p>
            )}
          </div>
        </div>

        {/* Live URL or Branch Status */}
        <div className="flex items-center gap-3 text-xs">
          {latest ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  latest.status === 'running' ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
                )} />
                <span className="text-zinc-400 font-medium">{latest.status}</span>
              </span>
              {runningCount > 1 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-tight">
                  {runningCount} running
                </span>
              )}
            </div>
          ) : (
            <span className="text-zinc-600">No deployment created</span>
          )}
        </div>

        {/* Bottom Metadata: Ingress domain, Git Commit & Deploys count */}
        <div className="flex items-center gap-4 text-[11px] text-zinc-500 pt-4 border-t border-[#16161a] mt-2 select-none">
          {project.baseDomain ? (
            <span className="flex items-center gap-1 max-w-[130px] truncate hover:text-zinc-300">
              <Globe className="h-3 w-3 text-zinc-500" />
              {project.baseDomain}
            </span>
          ) : latest?.liveUrl ? (
            <span className="flex items-center gap-1 max-w-[130px] truncate hover:text-zinc-300">
              <Globe className="h-3 w-3 text-zinc-500" />
              {latest.liveUrl.replace('http://', '').replace('https://', '')}
            </span>
          ) : (
            <span className="flex items-center gap-1 hover:text-zinc-300">
              <Globe className="h-3 w-3 text-zinc-500" />
              localhost
            </span>
          )}

          {latest?.branch && (
            <span className="flex items-center gap-1 hover:text-zinc-300 truncate">
              <GitBranch className="h-3 w-3 text-zinc-500" />
              {latest.branch}
            </span>
          )}

          {deployments.length > 0 && (
            <span className="ml-auto font-medium text-zinc-400 group-hover:text-amber-400 transition-colors">
              {deployments.length} deploys
            </span>
          )}
        </div>
      </div>
    </Link>

    <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
      <DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            Delete Project
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-2">
            Are you sure you want to delete <span className="font-semibold text-foreground font-mono">{project.name}</span>? This action cannot be undone and will permanently remove all associated container deployments, environments, and logs.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
          <Button
            variant="ghost"
            onClick={() => setIsDeleteOpen(false)}
            className="h-9 text-xs px-4 rounded-lg hover:bg-[#1a1a21]"
          >
            Cancel
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setIsDeleteOpen(false);
            }}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-xs h-9 px-4 rounded-lg transition-all"
          >
            Delete Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}
