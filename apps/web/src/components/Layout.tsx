import { useState } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useProjects } from '../hooks/useProjects';
import { useQuery } from '@tanstack/react-query';
import * as api from '../api/client';
import { parseMetrics } from '../lib/metrics';
import { cn } from '../lib/utils';
import { DequelLogo } from './DequelLogo';
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
  Laptop,
  Coffee
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

          {/* Brand Header */}
          <div className="px-6 pt-5 pb-3 flex items-center gap-2.5 border-b border-[#1a1a1f]">
            <DequelLogo className="h-6 w-6" />
            <span className="font-display font-black text-base tracking-wider bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              dequel
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono font-bold scale-90">
              v0.1
            </span>
          </div>

          {/* Workspace / Project Context Dropdown Selector */}
          <div className="p-4 border-b border-[#1a1a1f] relative">
            <button
              onClick={() => setProjectSelectorOpen(!projectSelectorOpen)}
              className="w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg bg-[#141417] border border-[#222227] hover:bg-[#1c1c21] hover:border-[#33333b] transition-all duration-200"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {currentProject ? (
                  <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-[10px] font-display font-black text-white shadow-sm shrink-0">
                    {currentProject.name.slice(0, 2).toUpperCase()}
                  </div>
                ) : (
                  <DequelLogo className="w-6 h-6 shrink-0" />
                )}
                <span className="font-display font-semibold text-xs truncate text-zinc-200">
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
                    <DequelLogo className="h-3.5 w-3.5" />
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
                        <div className="w-4 h-4 rounded bg-zinc-800 flex items-center justify-center text-[8px] font-display font-black text-zinc-300">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate font-display">{p.name}</span>
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

          {/* Buy me a coffee banner */}
          <div className="rounded-lg bg-gradient-to-r from-[#FFDD00]/5 to-amber-500/5 border border-[#FFDD00]/10 p-3 space-y-2 text-zinc-300 shadow-sm relative overflow-hidden group">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <Coffee className="h-3.5 w-3.5" />
              Support Dequel
            </div>
            <p className="text-[10px] text-zinc-400 leading-normal">
              Help keep Dequel open source and support its development!
            </p>
            <a
              href="https://buymeacoffee.com/rm.rf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full bg-[#FFDD00] text-black font-semibold rounded-lg py-2 text-sm hover:bg-[#ffe42b] transition-colors shadow-sm select-none active:scale-[0.98]"
              style={{ fontFamily: "'Cookie', cursive", fontSize: "16px", lineHeight: "20px" }}
            >
              <svg width="14" height="20" viewBox="0 0 35 50" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 scale-90 translate-y-[-1px]">
                <path d="M30.7512 11.6307L30.7171 11.6106L30.6382 11.5865C30.6699 11.6134 30.7097 11.6289 30.7512 11.6307Z" fill="#000000"/>
                <path d="M31.2481 15.2031L31.21 15.2138L31.2481 15.2031Z" fill="#000000"/>
                <path d="M30.7659 11.6253C30.761 11.6247 30.7563 11.6236 30.7517 11.6219C30.7514 11.6251 30.7514 11.6283 30.7517 11.6314C30.7569 11.6307 30.7618 11.6286 30.7659 11.6253Z" fill="#000000"/>
                <path d="M30.7515 11.6314H30.7572V11.6278L30.7515 11.6314Z" fill="#000000"/>
                <path d="M31.2178 15.1962L31.2753 15.1634L31.2967 15.1514L31.3161 15.1307C31.2796 15.1464 31.2463 15.1686 31.2178 15.1962Z" fill="#000000"/>
                <path d="M30.8507 11.7088L30.7945 11.6553L30.7563 11.6345C30.7768 11.6707 30.8107 11.6973 30.8507 11.7088Z" fill="#000000"/>
                <path d="M16.715 46.3714C16.6701 46.3908 16.6307 46.4212 16.6006 46.4597L16.636 46.4369C16.6601 46.4149 16.6942 46.3888 16.715 46.3714Z" fill="#000000"/>
                <path d="M24.9235 44.7473C24.9235 44.6965 24.8987 44.7059 24.9048 44.8864C24.9048 44.8717 24.9108 44.857 24.9134 44.843C24.9168 44.8109 24.9195 44.7794 24.9235 44.7473Z" fill="#000000"/>
                <path d="M24.0719 46.3714C24.027 46.3908 23.9877 46.4212 23.9575 46.4597L23.993 46.4369C24.017 46.4149 24.0512 46.3888 24.0719 46.3714Z" fill="#000000"/>
                <path d="M10.9344 46.7574C10.9003 46.7277 10.8586 46.7082 10.814 46.7012C10.8501 46.7186 10.8862 46.736 10.9103 46.7493L10.9344 46.7574Z" fill="#000000"/>
                <path d="M9.63391 45.5042C9.62859 45.4515 9.61242 45.4005 9.58643 45.3544C9.60484 45.4024 9.62025 45.4516 9.63258 45.5015L9.63391 45.5042Z" fill="#000000"/>
                <path d="M18.3715 23.0976C16.5857 23.8665 14.5591 24.7382 11.9326 24.7382C10.8339 24.736 9.74049 24.5844 8.68213 24.2875L10.4987 43.0444C10.563 43.8284 10.9181 44.5594 11.4935 45.0923C12.0689 45.6251 12.8225 45.9208 13.6047 45.9207C13.6047 45.9207 16.1804 46.0552 17.0398 46.0552C17.9648 46.0552 20.7385 45.9207 20.7385 45.9207C21.5205 45.9207 22.274 45.6249 22.8493 45.092C23.4245 44.5592 23.7795 43.8283 23.8438 43.0444L25.7895 22.3173C24.92 22.0187 24.0425 21.8203 23.0533 21.8203C21.3424 21.8196 19.964 22.4122 18.3715 23.0976Z" fill="#ffffff"/>
                <path d="M3.05859 15.095L3.08936 15.1238L3.10943 15.1358C3.09397 15.1205 3.07693 15.1068 3.05859 15.095Z" fill="#000000"/>
                <path d="M34.1896 13.3639L33.916 11.9762C33.6706 10.7312 33.1134 9.55468 31.8426 9.10468C31.4353 8.96073 30.9732 8.89885 30.6608 8.60086C30.3485 8.30288 30.2562 7.84009 30.1839 7.41094C30.0502 6.62326 29.9244 5.83492 29.7873 5.04859C29.6689 4.37257 29.5753 3.61315 29.267 2.99296C28.8657 2.16022 28.033 1.67322 27.205 1.35102C26.7807 1.19173 26.3477 1.05698 25.9081 0.947426C23.8394 0.398542 21.6644 0.196746 19.5362 0.0817228C16.9817 -0.0600379 14.4204 -0.0173274 11.872 0.209526C9.97525 0.383071 7.97745 0.592939 6.17495 1.25281C5.51616 1.49429 4.8373 1.7842 4.33634 2.29609C3.72169 2.92502 3.52104 3.89768 3.96982 4.68199C4.28886 5.23895 4.82927 5.63245 5.40246 5.89276C6.14906 6.22818 6.92877 6.48341 7.72865 6.65421C9.95585 7.14928 12.2626 7.34368 14.538 7.42641C17.0599 7.52878 19.5859 7.44582 22.0958 7.1782C22.7165 7.10959 23.336 7.0273 23.9545 6.93134C24.6828 6.81901 25.1503 5.86115 24.9356 5.19388C24.6788 4.39611 23.9886 4.08669 23.208 4.2071C23.093 4.22526 22.9786 4.24208 22.8636 4.25889L22.7807 4.271C22.5163 4.30463 22.2518 4.33602 21.9874 4.36517C21.4412 4.42437 20.8937 4.4728 20.3448 4.51046C19.1155 4.59656 17.8828 4.63625 16.6508 4.63827C15.4403 4.63827 14.229 4.60396 13.0211 4.52392C12.47 4.48759 11.9202 4.4414 11.3718 4.38535C11.1223 4.35912 10.8735 4.33154 10.6247 4.3006L10.3879 4.27033L10.3364 4.26293L10.091 4.22728C9.58933 4.15127 9.08771 4.06382 8.59144 3.95822C8.54136 3.94704 8.49657 3.91902 8.46446 3.87879C8.43236 3.83855 8.41486 3.7885 8.41486 3.73691C8.41486 3.68533 8.43236 3.63528 8.46446 3.59504C8.49657 3.55481 8.54136 3.52679 8.59144 3.51561H8.6008C9.03086 3.42346 9.46426 3.34476 9.899 3.27615C10.0439 3.25328 10.1893 3.23086 10.3351 3.20888H10.3391C10.6113 3.19072 10.8849 3.14162 11.1557 3.10933C13.5125 2.86279 15.8832 2.77874 18.2513 2.85776C19.4011 2.89139 20.5501 2.95933 21.6945 3.07637C21.9406 3.10193 22.1854 3.12884 22.4302 3.15911C22.5238 3.17054 22.6181 3.18399 22.7124 3.19543L22.9024 3.22301C23.4562 3.30597 24.0071 3.40664 24.5551 3.52503C25.367 3.70261 26.4097 3.76046 26.7709 4.65508C26.8859 4.93894 26.9381 5.25442 27.0016 5.5524L27.0826 5.93245C27.0847 5.93927 27.0863 5.94624 27.0873 5.9533C27.2785 6.85017 27.4701 7.74704 27.6618 8.64391C27.6758 8.71017 27.6762 8.77862 27.6628 8.84501C27.6493 8.9114 27.6225 8.97429 27.5838 9.02977C27.5451 9.08525 27.4955 9.13212 27.4381 9.16746C27.3806 9.2028 27.3165 9.22585 27.2498 9.23517H27.2444L27.1274 9.25132L27.0117 9.26679C26.6452 9.31477 26.2782 9.35961 25.9108 9.40132C25.1871 9.48428 24.4623 9.55603 23.7364 9.61657C22.294 9.7372 20.8486 9.81635 19.4004 9.85401C18.6625 9.87374 17.9247 9.88294 17.1872 9.88159C14.2517 9.87926 11.3188 9.70768 8.40283 9.36769C8.08714 9.33002 7.77145 9.28966 7.45577 9.24863C7.70056 9.28024 7.27786 9.22441 7.19225 9.2123C6.9916 9.18405 6.79095 9.15468 6.5903 9.12419C5.91679 9.02262 5.24729 8.8975 4.57511 8.78786C3.76249 8.65333 2.98531 8.72059 2.25026 9.12419C1.6469 9.45624 1.15857 9.96544 0.850401 10.5838C0.533376 11.243 0.439071 11.9608 0.297279 12.6691C0.155487 13.3774 -0.0652275 14.1395 0.0183763 14.8666C0.198292 16.4359 1.28915 17.7113 2.85823 17.9965C4.33434 18.2655 5.81847 18.4835 7.30662 18.6691C13.1524 19.3892 19.0582 19.4753 24.9223 18.9261C25.3998 18.8812 25.8767 18.8324 26.3529 18.7794C26.5016 18.763 26.6521 18.7802 26.7934 18.8299C26.9347 18.8795 27.0631 18.9603 27.1693 19.0663C27.2755 19.1724 27.3567 19.3009 27.4071 19.4426C27.4575 19.5843 27.4757 19.7356 27.4605 19.8853L27.312 21.3369C27.0128 24.2701 26.7136 27.2031 26.4144 30.1358C26.1023 33.2157 25.7882 36.2953 25.472 39.3747C25.3829 40.242 25.2937 41.109 25.2045 41.9758C25.1189 42.8294 25.1069 43.7099 24.9457 44.5534C24.6915 45.8799 23.7986 46.6945 22.4957 46.9925C21.3021 47.2657 20.0827 47.4091 18.8586 47.4203C17.5016 47.4277 16.1452 47.3672 14.7881 47.3746C13.3395 47.3826 11.5651 47.2481 10.4468 46.1638C9.46426 45.2113 9.32849 43.72 9.19472 42.4306C9.01637 40.7234 8.83957 39.0164 8.66434 37.3097L7.68116 27.8192L7.0451 21.6786C7.0344 21.577 7.0237 21.4768 7.01367 21.3745C6.93742 20.642 6.42176 19.925 5.60913 19.962C4.91354 19.9929 4.12299 20.5875 4.20458 21.3745L4.67611 25.927L5.65126 35.3442C5.92905 38.0191 6.20617 40.6944 6.48262 43.3703C6.53613 43.8828 6.58628 44.3967 6.64247 44.9093C6.94812 47.7102 9.075 49.2196 11.7089 49.6448C13.2472 49.8936 14.8229 49.9448 16.384 49.9703C18.3851 50.0026 20.4063 50.08 22.3747 49.7154C25.2915 49.1773 27.4799 47.2185 27.7922 44.1801C27.8814 43.303 27.9706 42.4256 28.0597 41.548C28.3563 38.6458 28.6523 35.7433 28.9479 32.8406L29.9151 23.3562L30.3585 19.0095C30.3806 18.794 30.4711 18.5913 30.6166 18.4315C30.7621 18.2717 30.9549 18.1633 31.1665 18.1223C32.0005 17.9588 32.7977 17.6796 33.391 17.0413C34.3354 16.0249 34.5233 14.6998 34.1896 13.3639ZM2.81542 14.3016C2.82813 14.2955 2.80472 14.4052 2.79469 14.4563C2.79268 14.3789 2.7967 14.3103 2.81542 14.3016ZM2.89635 14.9312C2.90304 14.9265 2.9231 14.9534 2.94384 14.9857C2.9124 14.9561 2.89234 14.9339 2.89568 14.9312H2.89635ZM2.97594 15.0368C3.0047 15.0859 3.02009 15.1168 2.97594 15.0368V15.0368ZM3.13579 15.1673H3.1398C3.1398 15.172 3.14716 15.1767 3.14984 15.1814C3.1454 15.1762 3.14048 15.1715 3.13513 15.1673H3.13579ZM31.1277 14.9722C30.828 15.2588 30.3766 15.392 29.9305 15.4586C24.9276 16.2052 19.8519 16.5832 14.7942 16.4164C11.1745 16.292 7.59287 15.8877 4.00928 15.3785C3.65815 15.3287 3.27758 15.2642 3.03614 15.0038C2.58133 14.5128 2.80472 13.524 2.9231 12.9307C3.03145 12.3872 3.23879 11.6628 3.88154 11.5854C4.88478 11.467 6.04989 11.8928 7.04243 12.0442C8.2374 12.2276 9.43684 12.3744 10.6407 12.4848C15.7787 12.9556 21.0029 12.8823 26.1181 12.1935C27.0505 12.0675 27.9795 11.9211 28.9051 11.7543C29.7298 11.6056 30.6441 11.3264 31.1424 12.1854C31.4841 12.7706 31.5296 13.5536 31.4768 14.2148C31.4605 14.5029 31.3354 14.7739 31.127 14.9722H31.1277Z" fill="#000000"/>
              </svg>
              Buy me a coffee
            </a>
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
