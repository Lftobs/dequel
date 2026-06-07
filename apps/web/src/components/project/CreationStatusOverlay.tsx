import { Button } from '../ui/button';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface CreationStatusOverlayProps {
  submittingStatus: 'idle' | 'creating_project' | 'creating_envs' | 'creating_db' | 'done' | 'error';
  errorMessage: string;
  hasEnvs: boolean;
  hasDb: boolean;
  dbType: 'postgresql' | 'mysql';
  onRetry: () => void;
}

export function CreationStatusOverlay({
  submittingStatus,
  errorMessage,
  hasEnvs,
  hasDb,
  dbType,
  onRetry
}: CreationStatusOverlayProps) {
  if (submittingStatus === 'idle') return null;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 space-y-6">
      <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
        {submittingStatus === 'creating_project' && 'Initializing Project...'}
        {submittingStatus === 'creating_envs' && 'Configuring Environment Variables...'}
        {submittingStatus === 'creating_db' && 'Provisioning Database Instance...'}
        {submittingStatus === 'done' && 'Project Configured Successfully!'}
        {submittingStatus === 'error' && 'Configuration Failed'}
      </h3>

      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">1. Initialize workspace project record</span>
          {submittingStatus === 'creating_project' ? (
            <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
          ) : (submittingStatus === 'error' && !errorMessage.includes('env') && !errorMessage.includes('database')) ? (
            <XCircle className="h-4 w-4 text-red-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          )}
        </div>

        {hasEnvs && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">2. Securely store environment variables</span>
            {submittingStatus === 'creating_project' ? (
              <div className="h-2.5 w-2.5 rounded-full bg-zinc-800" />
            ) : submittingStatus === 'creating_envs' ? (
              <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
            ) : submittingStatus === 'error' && errorMessage.includes('env') ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            )}
          </div>
        )}

        {hasDb && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">3. Provision dedicated {dbType} database instance</span>
            {(submittingStatus === 'creating_project' || submittingStatus === 'creating_envs') ? (
              <div className="h-2.5 w-2.5 rounded-full bg-zinc-800" />
            ) : submittingStatus === 'creating_db' ? (
              <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
            ) : submittingStatus === 'error' && errorMessage.includes('database') ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : submittingStatus === 'done' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <div className="h-2.5 w-2.5 rounded-full bg-zinc-800" />
            )}
          </div>
        )}
      </div>

      {submittingStatus === 'done' && (
        <div className="text-center text-xs text-zinc-500 animate-pulse">
          Redirecting to workspace...
        </div>
      )}

      {submittingStatus === 'error' && (
        <div className="w-full bg-red-950/20 border border-red-900/30 rounded-lg p-3 space-y-2">
          <p className="text-xs text-red-400 font-semibold flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0" /> Error Details
          </p>
          <p className="text-[11px] text-zinc-400 font-mono break-all leading-relaxed">{errorMessage}</p>
          <Button onClick={onRetry} size="sm" className="w-full bg-red-900 hover:bg-red-800 text-white font-medium text-[10px] h-7 mt-1">
            Back to wizard & try again
          </Button>
        </div>
      )}
    </div>
  );
}
