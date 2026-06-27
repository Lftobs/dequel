import { useState, type FormEvent } from 'react';
import * as api from '../api/client';
import { DequelLogo } from '../components/DequelLogo';
import { Lock, User, Terminal, ArrowRight, Shield, Activity, RefreshCw } from 'lucide-react';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(username, password);
      if (res.ok) {
        window.location.href = '/';
      } else {
        setError(res.error || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#070708] text-zinc-100 flex items-center justify-center p-6 sm:p-10 lg:p-16 relative overflow-hidden select-none">
      {/* Background glow using Dequel orange */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-orange-500/[0.02] blur-[100px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2" />

      {/* Center content container for closer alignment */}
      <div className="w-full max-w-4xl flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16 z-10">
        
        {/* Left Column: Login Card & Heading */}
        <div className="w-full max-w-sm flex flex-col justify-between min-h-[480px] space-y-6">
          {/* Logo Branding */}
          <div className="flex items-center gap-2">
            <DequelLogo className="h-6 w-6" />
            <span className="font-display font-bold text-base tracking-wider text-zinc-200">
              dequel
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20 font-mono font-bold">
              v0.1
            </span>
          </div>

          {/* Form */}
          <div className="space-y-5">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                Sign in to Dequel
              </h1>
              <p className="text-zinc-500 text-xs leading-normal">
                Enter your credentials to access your self-hosted deployment engine.
              </p>
            </div>

            <div className="relative rounded-xl border border-[#1a1a1f] bg-[#0c0c0e] p-5 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-[#1a1a1f] pb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-zinc-400" />
                  Security Gateway
                </span>
                <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-medium">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-655" />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#222227] bg-[#121214] text-zinc-200 text-xs placeholder-zinc-700 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all"
                      placeholder="Linux username"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-655" />
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#222227] bg-[#121214] text-zinc-200 text-xs placeholder-zinc-700 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all"
                      placeholder="Linux password"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-[11px] text-rose-400 bg-rose-500/5 rounded-lg px-3 py-2 border border-rose-500/10 leading-normal">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 group"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Footer Info */}
          <div className="text-[10px] text-zinc-600 font-mono pt-4">
            &copy; {new Date().getFullYear()} Dequel.
          </div>
        </div>

        {/* Right Column: Clean, Low-contrast CSS Mockup of Dequel Dashboard */}
        <div className="hidden lg:flex w-full max-w-[480px] aspect-[16/10] rounded-xl border border-[#1a1a1f] bg-[#0c0c0e] shadow-xl flex flex-col overflow-hidden shrink-0">
          {/* Header Mockup */}
          <div className="h-8 bg-[#101012] border-b border-[#1a1a1f] flex items-center px-3 justify-between">
            <div className="flex gap-1 items-center">
              <span className="w-2 h-2 rounded-full bg-zinc-800" />
              <span className="w-2 h-2 rounded-full bg-zinc-800" />
              <span className="w-2 h-2 rounded-full bg-zinc-800" />
            </div>
            <div className="w-48 h-4 rounded bg-[#070708] border border-[#1a1a1f] flex items-center justify-center text-[8px] text-zinc-600 font-mono">
              dequel.local/dashboard
            </div>
            <div className="w-8" />
          </div>

          {/* Content Layout Mockup */}
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Mockup */}
            <div className="w-32 border-r border-[#1a1a1f] bg-[#09090b] p-2.5 flex flex-col justify-between text-[8px]">
              <div className="space-y-3">
                <div className="flex items-center gap-1 px-1 pb-1.5 border-b border-[#1a1a1f]/60">
                  <DequelLogo className="h-3 w-3" />
                  <span className="font-bold text-zinc-400">dequel</span>
                </div>
                
                <div className="space-y-1">
                  <div className="h-5 rounded bg-orange-500/10 flex items-center px-1.5 text-orange-500 gap-1 font-semibold">
                    <Activity className="h-2.5 w-2.5 text-orange-500" />
                    Overview
                  </div>
                  <div className="h-5 rounded flex items-center px-1.5 text-zinc-650 gap-1">
                    <Terminal className="h-2.5 w-2.5" />
                    Logs
                  </div>
                </div>
              </div>

              {/* Sidebar Footer Widget Mockup */}
              <div className="rounded bg-[#101012] border border-[#1a1a1f] p-1.5 space-y-1 text-[7px]">
                <div className="flex items-center justify-between text-zinc-500 pb-1 border-b border-[#1a1a1f]">
                  <span className="font-bold">STATUS</span>
                  <span className="text-emerald-500 flex items-center gap-0.5">
                    <span className="w-0.5 h-0.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Services</span>
                  <span className="font-mono text-zinc-400">3</span>
                </div>
              </div>
            </div>

            {/* Main Area Mockup */}
            <div className="flex-1 bg-[#070708] p-3 flex flex-col gap-3">
              <div className="flex justify-between items-center pb-1.5 border-b border-[#1a1a1f]">
                <div>
                  <h3 className="text-[10px] font-bold text-zinc-300">Overview</h3>
                  <p className="text-[7px] text-zinc-600">Manage and monitor cluster resources.</p>
                </div>
                <div className="h-4.5 px-2 rounded bg-orange-500 text-white text-[7px] font-bold flex items-center justify-center">
                  + New Project
                </div>
              </div>

              {/* Metric stats card */}
              <div className="grid grid-cols-2 gap-2 text-[8px]">
                <div className="rounded border border-[#1a1a1f] bg-[#0c0c0e] p-2 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-zinc-650 font-bold uppercase text-[6px]">API Traffic</div>
                    <div className="text-zinc-300 font-mono font-bold">148 <span className="text-[6px] text-zinc-600 font-normal">reqs</span></div>
                  </div>
                  <Activity className="h-2.5 w-2.5 text-orange-500 animate-pulse" />
                </div>

                <div className="rounded border border-[#1a1a1f] bg-[#0c0c0e] p-2 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-zinc-650 font-bold uppercase text-[6px]">Deployments</div>
                    <div className="text-zinc-300 font-mono font-bold">3 <span className="text-[6px] text-zinc-600 font-normal">active</span></div>
                  </div>
                  <Shield className="h-2.5 w-2.5 text-rose-500" />
                </div>
              </div>

              {/* Projects list */}
              <div className="space-y-1.5">
                <div className="rounded border border-[#1a1a1f] bg-[#0c0c0e] p-2 flex items-center justify-between text-[8px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-zinc-800 flex items-center justify-center font-bold text-[7px] text-zinc-400">
                      A
                    </div>
                    <div>
                      <div className="font-bold text-zinc-300">api-service</div>
                      <div className="text-[6px] text-zinc-655">github.com/lftobs/api</div>
                    </div>
                  </div>
                  <span className="text-[6px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                    running
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
