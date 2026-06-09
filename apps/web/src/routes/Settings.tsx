import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { StatusBadge } from '../components/StatusBadge';
import { Trash2, Server, Key } from 'lucide-react';
import * as api from '../api/client';

export function Settings() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>
      <div className="grid gap-6">
        <ServersSection />
        <ApiKeysSection />
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
                        onClick={() => api.deleteServer(s.id).then(() => refetch())}>
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
    </Card>
  );
}

function ApiKeysSection() {
  const { data: apiKeys = [], refetch } = useQuery({
    queryKey: ['api-keys'], queryFn: () => api.listApiKeys().catch(() => []),
  });
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState('');

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
                        onClick={() => api.deleteApiKey(k.id).then(() => refetch())}>
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
    </Card>
  );
}
