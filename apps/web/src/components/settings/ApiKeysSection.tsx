import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Trash2, Key } from 'lucide-react';
import * as api from '../../api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';

export function ApiKeysSection() {
  const { data: apiKeys = [], refetch } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.listApiKeys().catch(() => []),
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
    setName('');
    refetch();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">API Keys</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {newKey && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-400">
            <strong className="block mb-1">API Key created — copy it now:</strong>
            <code className="block bg-emerald-950/50 rounded px-2 py-1 font-mono text-xs break-all">{newKey}</code>
          </div>
        )}
        <form onSubmit={add} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="grid gap-1.5 flex-1">
            <label className="text-xs font-medium text-muted-foreground">Key Name</label>
            <Input placeholder="ci-cd-token" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button type="submit" size="sm" className="w-full sm:w-auto h-9">
            Generate Key
          </Button>
        </form>

        {apiKeys.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="md:hidden divide-y divide-border">
              {apiKeys.map((k) => (
                <div key={k.id} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{k.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{k.keyHash?.slice(0, 12)}...</p>
                    <p className="text-[11px] text-muted-foreground/70">{new Date(k.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setDeletingKeyId(k.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key Hash</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{k.keyHash?.slice(0, 12)}...</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{new Date(k.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeletingKeyId(k.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
            <Button variant="ghost" onClick={() => setDeletingKeyId(null)} className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]">
              Cancel
            </Button>
            <Button onClick={handleDeleteKey} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg transition-all">
              Delete Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
