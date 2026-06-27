import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from './ui/button';
import { Globe, Mail, GitBranch, type LucideIcon } from 'lucide-react';
import * as api from '../api/client';

export function ConfigWarnings() {
  const [dismissed, setDismissed] = useState<string[]>([]);

  const smtp = useQuery({
    queryKey: ['smtp-settings'], queryFn: () => api.getSmtpSettings(),
  });
  const github = useQuery({
    queryKey: ['github-integration'], queryFn: () => api.getGithubIntegration(),
  });
  const serverInfo = useQuery({
    queryKey: ['server-ip'], queryFn: () => api.getServerIp(),
  });

  const missing: { key: string; icon: LucideIcon; title: string; desc: string }[] = [];
  if (smtp.data && !smtp.data.configured) {
    missing.push({
      key: 'smtp',
      icon: Mail,
      title: 'SMTP not configured',
      desc: 'Set up SMTP to enable email alerts and notifications.',
    });
  }
  if (github.data && !github.data.configured) {
    missing.push({
      key: 'github',
      icon: GitBranch,
      title: 'GitHub integration not configured',
      desc: 'Connect a GitHub OAuth App to enable the repo picker and auto-deploy.',
    });
  }
  if (serverInfo.data && !serverInfo.data.resolves) {
    missing.push({
      key: 'base-domain',
      icon: Globe,
      title: 'Base domain misconfigured',
      desc: `The base domain ${serverInfo.data.baseDomain} does not resolve to this server (${serverInfo.data.ip}). Access the dashboard at ${serverInfo.data.url}.`,
    });
  }

  if (missing.length === 0) return null;

  return (
    <div className="grid gap-3 mb-6">
      {missing.filter(m => !dismissed.includes(m.key)).map(m => (
        <div
          key={m.key}
          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 gap-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/15">
              <m.icon className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">{m.title}</h4>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{m.desc}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(prev => [...prev, m.key])}
            className="text-xs h-8 px-3 rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground shrink-0 self-end sm:self-center"
          >
            Dismiss
          </Button>
        </div>
      ))}
    </div>
  );
}
