import { useState } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useProjects } from '../hooks/useProjects';
import { useQuery } from '@tanstack/react-query';
import * as api from '../api/client';
import { parseMetrics } from '../lib/metrics';
import { cn } from '../lib/utils';
import {
  Box,
  Settings,
  ChevronRight,
  ChevronDown,
  Activity,
  Terminal,
  Sliders,
  Globe,
  Database,
  HardDrive,
  Bell,
  Sparkles,
  Layers,
  ArrowUpRight,
  TrendingUp,
  FolderGit,
  Search,
  ExternalLink,
  Laptop
} from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);

  // Fetch metrics for sidebar usage stats
  const { data: metricsText } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => api.getMetrics(),
    refetchInterval: 15000,
  });

  const metrics = metricsText ? parseMetrics(metricsText) : null;

  // Extract active project id if we are inside a project route
  const match = location.pathname.match(/\/project\/([^/]+)/);
  const currentProjectId = match ? match[1] : null;
  const currentProject = projects.find(p => p.id === currentProjectId);

  // Helper to check if a navigation item is active
  const isTabActive = (tabName: string) => {
    const activeTab = new URLSearchParams(location.search).get('tab') || 'deployments';
    return activeTab === tabName;
  };

  return (
    <div className="flex min-h-screen bg-[#070708] text-zinc-100 font-sans antialiased">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#1a1a1f] bg-[#0c0c0e] shrink-0 flex flex-col justify-between select-none">
        <div className="flex flex-col flex-1 min-h-0">
          
          {/* Workspace / Project Context Dropdown Selector */}
          <div className="p-4 border-b border-[#1a1a1f] relative">
            <button
              onClick={() => setProjectSelectorOpen(!projectSelectorOpen)}
              className="w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg bg-[#141417] border border-[#222227] hover:bg-[#1c1c21] hover:border-[#33333b] transition-all duration-200"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-[10px] font-black text-white shadow-sm shrink-0">
                  {currentProject ? currentProject.name.slice(0, 2).toUpperCase() : 'DQ'}
                </div>
                <span className="font-medium text-xs truncate text-zinc-200">
                  {currentProject ? currentProject.name : 'All Projects'}
                </span>
              </div>
              <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-500 transition-transform duration-200", projectSelectorOpen && "transform rotate-180")} />
            </button>

            {/* Dropdown Options */}
            {projectSelectorOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProjectSelectorOpen(false)} />
                <div className="absolute top-[calc(100%-8px)] left-4 right-4 mt-2 py-1.5 rounded-lg border border-[#27272a] bg-[#111113] shadow-xl z-20 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-100">
                  <Link
                    to="/"
                    onClick={() => setProjectSelectorOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-[#1a1a1e] transition-colors"
                  >
                    <Box className="h-3.5 w-3.5 text-zinc-500" />
                    <span>All Projects</span>
                  </Link>
                  <div className="h-[1px] bg-[#1d1d21] my-1" />
                  {projects.map(p => (
                    <Link
                      key={p.id}
                      to="/project/$projectId"
                      params={{ projectId: p.id }}
                      search={{ tab: 'deployments' } as any}
                      onClick={() => setProjectSelectorOpen(false)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 text-xs transition-colors",
                        p.id === currentProjectId
                          ? "bg-amber-500/10 text-amber-400 font-medium"
                          : "text-zinc-400 hover:text-zinc-100 hover:bg-[#1a1a1e]"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-4 h-4 rounded bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-300">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{p.name}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto p-3 space-y-6">
            
            {/* Global Dashboards Group */}
            <div>
              <h4 className="px-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Dashboards</h4>
              <nav className="space-y-0.5">
                <Link
                  to="/"
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-all duration-200',
                    location.pathname === '/' && !currentProjectId
                      ? 'bg-zinc-800/60 text-zinc-100 font-medium shadow-inner'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]',
                  )}
                >
                  <Box className="h-4 w-4" />
                  Projects
                </Link>
                <Link
                  to="/settings"
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-all duration-200',
                    location.pathname.startsWith('/settings')
                      ? 'bg-zinc-800/60 text-zinc-100 font-medium shadow-inner'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]',
                  )}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </nav>
            </div>

            {/* Project Specific Tabs Section */}
            {currentProject && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="flex items-center justify-between px-3 mb-2">
                  <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Project Control</h4>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold uppercase tracking-tight scale-90">
                    Active
                  </span>
                </div>
                <nav className="space-y-0.5">
                  <button
                    onClick={() => navigate({ to: `/project/${currentProjectId}`, search: { tab: 'deployments' } })}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-left transition-all duration-200',
                      isTabActive('deployments')
                        ? 'bg-zinc-800/60 text-zinc-100 font-medium shadow-inner border-l-2 border-amber-500 pl-2.5'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]',
                    )}
                  >
                    <Layers className="h-4 w-4 text-zinc-400" />
                    Deployments
                  </button>

                  <button
                    onClick={() => navigate({ to: `/project/${currentProjectId}`, search: { tab: 'env-vars' } })}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-left transition-all duration-200',
                      isTabActive('env-vars')
                        ? 'bg-zinc-800/60 text-zinc-100 font-medium shadow-inner border-l-2 border-amber-500 pl-2.5'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]',
                    )}
                  >
                    <Sliders className="h-4 w-4 text-zinc-400" />
                    Env Variables
                  </button>

                  <button
                    onClick={() => navigate({ to: `/project/${currentProjectId}`, search: { tab: 'domains' } })}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-left transition-all duration-200',
                      isTabActive('domains')
                        ? 'bg-zinc-800/60 text-zinc-100 font-medium shadow-inner border-l-2 border-amber-500 pl-2.5'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]',
                    )}
                  >
                    <Globe className="h-4 w-4 text-zinc-400" />
                    Domains
                  </button>

                  <button
                    onClick={() => navigate({ to: `/project/${currentProjectId}`, search: { tab: 'databases' } })}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-left transition-all duration-200',
                      isTabActive('databases')
                        ? 'bg-zinc-800/60 text-zinc-100 font-medium shadow-inner border-l-2 border-amber-500 pl-2.5'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]',
                    )}
                  >
                    <Database className="h-4 w-4 text-zinc-400" />
                    Databases & Volumes
                  </button>

                  <button
                    onClick={() => navigate({ to: `/project/${currentProjectId}`, search: { tab: 'scaling' } })}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-left transition-all duration-200',
                      isTabActive('scaling')
                        ? 'bg-zinc-800/60 text-zinc-100 font-medium shadow-inner border-l-2 border-amber-500 pl-2.5'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]',
                    )}
                  >
                    <TrendingUp className="h-4 w-4 text-zinc-400" />
                    Auto Scaling
                  </button>

                  <button
                    onClick={() => navigate({ to: `/project/${currentProjectId}`, search: { tab: 'alerts' } })}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-left transition-all duration-200',
                      isTabActive('alerts')
                        ? 'bg-zinc-800/60 text-zinc-100 font-medium shadow-inner border-l-2 border-amber-500 pl-2.5'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]',
                    )}
                  >
                    <Bell className="h-4 w-4 text-zinc-400" />
                    Alerts Policies
                  </button>
                </nav>
              </div>
            )}

            {/* Monitoring & Observability section (Always present, but changes behavior) */}
            {currentProject && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-200">
                <h4 className="px-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Observability</h4>
                <nav className="space-y-0.5">
                  <button
                    onClick={() => navigate({ to: `/project/${currentProjectId}`, search: { tab: 'observability' } })}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-left transition-all duration-200',
                      isTabActive('observability')
                        ? 'bg-zinc-800/60 text-zinc-100 font-medium shadow-inner border-l-2 border-amber-500 pl-2.5'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]',
                    )}
                  >
                    <Activity className="h-4 w-4 text-zinc-400" />
                    Overview Metrics
                  </button>
                  <button
                    onClick={() => navigate({ to: `/project/${currentProjectId}`, search: { tab: 'logs' } })}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-left transition-all duration-200',
                      isTabActive('logs')
                        ? 'bg-zinc-800/60 text-zinc-100 font-medium shadow-inner border-l-2 border-amber-500 pl-2.5'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141417]',
                    )}
                  >
                    <Terminal className="h-4 w-4 text-zinc-400" />
                    Real-time Logs
                  </button>
                  <a
                    href="/grafana"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between px-3 py-2 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#141417] transition-all"
                  >
                    <span className="flex items-center gap-2.5">
                      <Laptop className="h-4 w-4 text-zinc-400" />
                      Open Grafana
                    </span>
                    <ArrowUpRight className="h-3 w-3 text-zinc-500" />
                  </a>
                </nav>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Footer Widget - Usage stats */}
        <div className="p-4 border-t border-[#1a1a1f] space-y-4">
          
          {/* Premium Node Usage Card */}
          <div className="rounded-lg bg-[#141417] border border-[#222227] p-3 space-y-2 text-[11px]">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="font-semibold">Node Status</span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-zinc-500 scale-95 origin-left">
                <span>Active Services</span>
                <span>{metrics?.activeDeployments ?? 0} running</span>
              </div>
              <div className="w-full bg-[#27272a] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(((metrics?.activeDeployments ?? 0) / 10) * 100, 100)}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-zinc-500 scale-95 origin-left">
                <span>API Traffic</span>
                <span>{metrics?.requestsTotal ?? 0} requests</span>
              </div>
              <div className="w-full bg-[#27272a] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-500 animate-pulse"
                  style={{ width: `${Math.min(((metrics?.requestsTotal ?? 0) / 1000) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Upgrade Alert banner */}
          <div className="rounded-lg bg-gradient-to-r from-amber-500/10 to-rose-500/10 border border-amber-500/20 p-3 space-y-1.5 text-zinc-300 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:scale-125 transition-transform duration-300">
              <Sparkles className="h-16 w-16 text-amber-500" />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <Sparkles className="h-3.5 w-3.5" />
              Upgrade to Pro
            </div>
            <p className="text-[10px] text-zinc-400 leading-normal">
              Unlock advanced metrics, anomaly alerts, and CDN optimization.
            </p>
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-600">
            <span>Dequel Platform v0.1</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Breadcrumbs */}
        <header className="h-14 border-b border-[#1a1a1f] bg-[#0c0c0e] flex items-center px-6 gap-2 text-xs text-zinc-500">
          <Link to="/" className="hover:text-zinc-200 transition-colors">Workspace</Link>
          <ChevronRight className="h-3 w-3 text-zinc-600" />
          {currentProject ? (
            <>
              <Link to="/project/$projectId" params={{ projectId: currentProjectId! }} search={{ tab: 'deployments' }} className="hover:text-zinc-200 transition-colors font-medium text-zinc-300">
                {currentProject.name}
              </Link>
              <ChevronRight className="h-3 w-3 text-zinc-600" />
              <span className="text-zinc-100 font-bold uppercase tracking-wider text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded">
                {new URLSearchParams(location.search).get('tab') || 'deployments'}
              </span>
            </>
          ) : (
            <span className="text-zinc-300 font-medium">Dashboard</span>
          )}
        </header>

        {/* Scrollable Main Wrapper */}
        <main className="flex-1 p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
