import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { StatusBadge } from '../components/StatusBadge';
import { Trash2, Server, Key, Mail } from 'lucide-react';
import * as api from '../api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { ConfigWarnings } from '../components/ConfigWarnings';

export function Settings() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>
      <ConfigWarnings />
      <div className="grid gap-6">
        <ServersSection />
        <ApiKeysSection />
        <SmtpSection />
        <GithubIntegrationSection />
      </div>
    </div>
  );
}

function ServersSection() {
  const { data: servers = [], refetch } = useQuery({
    queryKey: ['servers'], queryFn: () => api.listServers().catch(() => []),
  });
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('2376');
  const [authToken, setAuthToken] = useState('');

  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);

  const handleDeleteServer = async () => {
    if (!deletingServerId) return;
    await api.deleteServer(deletingServerId);
    setDeletingServerId(null);
    refetch();
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !host.trim()) return;
    await api.createServer({ name: name.trim(), host: host.trim(), port: Number(port), authToken: authToken.trim() });
    setName(''); setHost(''); setPort('2376'); setAuthToken(''); refetch();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2"><Server className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-lg">Servers</CardTitle></div>
      </CardHeader>
      <CardContent>
        <form onSubmit={add} className="flex flex-wrap items-end gap-3 mb-4">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input placeholder="prod-node-1" value={name} onChange={e => setName(e.target.value)} className="w-36" />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Host</label>
            <Input placeholder="192.168.1.10" value={host} onChange={e => setHost(e.target.value)} className="w-44" />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Port</label>
            <Input type="number" value={port} onChange={e => setPort(e.target.value)} className="w-20" />
          </div>
          <Button type="submit" size="sm">Add Server</Button>
        </form>
        {servers.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>Host</TableHead><TableHead>Status</TableHead><TableHead className="w-12"></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {servers.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="font-mono text-xs">{s.host}:{s.port}</TableCell>
                    <TableCell><StatusBadge status={s.status || 'active'} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeletingServerId(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={deletingServerId !== null} onOpenChange={(open) => { if (!open) setDeletingServerId(null); }}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Remove Server</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-2">
              Are you sure you want to remove this server from the cluster? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
            <Button variant="ghost" onClick={() => setDeletingServerId(null)}
              className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]">Cancel</Button>
            <Button onClick={handleDeleteServer}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg transition-all">Remove Server</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SmtpSection() {
  const { data, refetch } = useQuery({
    queryKey: ['smtp-settings'], queryFn: () => api.getSmtpSettings(),
  });
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (data?.configured) {
      setHost(data.host || '');
      setPort(String(data.port || 587));
      setUser(data.user || '');
      setFromAddress(data.fromAddress || '');
    }
  }, [data]);

  const [saveResult, setSaveResult] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveResult(null);
    try {
      await api.setSmtpSettings({ host: host.trim(), port: Number(port), user, pass, fromAddress });
      setPass('');
      refetch();
      setSaveResult('Settings saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSaveResult('error: ' + message);
    }
  };

  const test = async () => {
    setTestResult(null);
    try {
      await api.testSmtpSettings();
      setTestResult('Test email sent successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setTestResult('error: ' + message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2"><Mail className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-lg">SMTP Settings</CardTitle></div>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-wrap items-end gap-3 mb-4">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Host</label>
            <Input placeholder="smtp.example.com" value={host} onChange={e => setHost(e.target.value)} className="w-44" />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Port</label>
            <Input type="number" value={port} onChange={e => setPort(e.target.value)} className="w-20" />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Username</label>
            <Input placeholder="user" value={user} onChange={e => setUser(e.target.value)} className="w-36" />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Password</label>
            <Input type="password" placeholder={data?.configured ? '(unchanged)' : ''} value={pass} onChange={e => setPass(e.target.value)} className="w-36" />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">From Address</label>
            <Input placeholder="dequel@example.com" value={fromAddress} onChange={e => setFromAddress(e.target.value)} className="w-44" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">Save</Button>
            <Button type="button" size="sm" variant="secondary" onClick={test} disabled={!data?.configured}>Test</Button>
          </div>
        </form>
        {saveResult && (
          <p className={`text-xs ${saveResult.startsWith('error') ? 'text-red-400' : 'text-emerald-400'}`}>{saveResult}</p>
        )}
        {testResult && (
          <p className={`text-xs ${testResult.startsWith('error') ? 'text-red-400' : 'text-emerald-400'}`}>{testResult}</p>
        )}
      </CardContent>
    </Card>
  );
}

function GithubIntegrationSection() {
  const { data, refetch } = useQuery({
    queryKey: ['github-integration'], queryFn: () => api.getGithubIntegration(),
  });
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [appName, setAppName] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [saveResult, setSaveResult] = useState<string | null>(null);

  useEffect(() => {
    if (data?.configured) {
      setClientId(data.clientId || '');
      setAppName(data.appName || '');
    }
  }, [data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveResult(null);
    try {
      await api.setGithubIntegration({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        appName: appName.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
      });
      setClientSecret('');
      setWebhookSecret('');
      refetch();
      setSaveResult('Settings saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSaveResult('error: ' + message);
    }
  };

  const icon = (
    <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">{icon}<CardTitle className="text-lg">GitHub Integration</CardTitle></div>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-wrap items-end gap-3 mb-4">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Client ID</label>
            <Input placeholder="Iv1..." value={clientId} onChange={e => setClientId(e.target.value)} className="w-56" />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Client Secret</label>
            <Input type="password" placeholder={data?.configured ? '(unchanged)' : ''} value={clientSecret} onChange={e => setClientSecret(e.target.value)} className="w-64" />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">App Name</label>
            <Input placeholder="Dequel" value={appName} onChange={e => setAppName(e.target.value)} className="w-36" />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Webhook Secret</label>
            <Input type="password" placeholder={data?.hasWebhookSecret ? '(unchanged)' : ''} value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} className="w-48" />
          </div>
          <Button type="submit" size="sm">Save</Button>
        </form>
        {!data?.configured && (
          <p className="text-xs text-amber-400">GitHub is not configured. Add your OAuth App credentials to enable the repo picker.</p>
        )}
        {saveResult && (
          <p className={`text-xs ${saveResult.startsWith('error') ? 'text-red-400' : 'text-emerald-400'}`}>{saveResult}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ApiKeysSection() {
  const { data: apiKeys = [], refetch } = useQuery({
    queryKey: ['api-keys'], queryFn: () => api.listApiKeys().catch(() => []),
  });
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState('');

  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);

  const handleDeleteKey = async () => {
    if (!deletingKeyId) return;
    await api.deleteApiKey(deletingKeyId);
    setDeletingKeyId(null);
    refetch();
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const result = await api.createApiKey({ name: name.trim() });
    setNewKey(result.rawKey || '');
    setName(''); refetch();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2"><Key className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-lg">API Keys</CardTitle></div>
      </CardHeader>
      <CardContent>
        {newKey && (
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-400">
            <strong className="block mb-1">API Key created — copy it now:</strong>
            <code className="block bg-emerald-950/50 rounded px-2 py-1 font-mono text-xs break-all">{newKey}</code>
          </div>
        )}
        <form onSubmit={add} className="flex items-end gap-3 mb-4">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Key Name</label>
            <Input placeholder="ci-cd-token" value={name} onChange={e => setName(e.target.value)} className="w-56" />
          </div>
          <Button type="submit" size="sm">Generate Key</Button>
        </form>
        {apiKeys.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>Key Hash</TableHead><TableHead>Created</TableHead><TableHead className="w-12"></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map(k => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{k.keyHash?.slice(0, 12)}...</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(k.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeletingKeyId(k.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={deletingKeyId !== null} onOpenChange={(open) => { if (!open) setDeletingKeyId(null); }}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Delete API Key</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-2">
              Are you sure you want to delete this API key? Any services using it will lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
            <Button variant="ghost" onClick={() => setDeletingKeyId(null)}
              className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]">Cancel</Button>
            <Button onClick={handleDeleteKey}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg transition-all">Delete Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
