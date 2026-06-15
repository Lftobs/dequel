import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { cn } from '../../../lib/utils';
import { Server, Upload, Trash2 } from 'lucide-react';

interface StagedEnv {
  key: string;
  value: string;
  environment?: string;
}

interface StepEnvironmentProps {
  stagedEnvs: StagedEnv[];
  setStagedEnvs: React.Dispatch<React.SetStateAction<StagedEnv[]>>;
}

export function StepEnvironment({ stagedEnvs, setStagedEnvs }: StepEnvironmentProps) {
  const [envTab, setEnvTab] = useState<'single' | 'bulk' | 'file'>('single');
  const [singleKey, setSingleKey] = useState('');
  const [singleVal, setSingleVal] = useState('');
  const [singleEnv, setSingleEnv] = useState('production');
  const [bulkText, setBulkText] = useState('');
  const [fileError, setFileError] = useState('');

  const parseEnvText = (text: string): StagedEnv[] => {
    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
    
    const result: StagedEnv[] = [];
    for (const line of lines) {
      const idx = line.indexOf('=');
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!key) continue;
      result.push({ key, value, environment: 'production' });
    }
    return result;
  };

  const handleAddSingle = () => {
    if (!singleKey.trim() || !singleVal.trim()) return;
    setStagedEnvs(prev => {
      const next = [...prev];
      const idx = next.findIndex(x => x.key === singleKey.trim());
      if (idx >= 0) {
        next[idx] = { key: singleKey.trim(), value: singleVal.trim(), environment: singleEnv };
      } else {
        next.push({ key: singleKey.trim(), value: singleVal.trim(), environment: singleEnv });
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
    setStagedEnvs(prev => {
      const next = [...prev];
      for (const item of parsed) {
        const idx = next.findIndex(x => x.key === item.key);
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
      setStagedEnvs(prev => {
        const next = [...prev];
        for (const item of parsed) {
          const idx = next.findIndex(x => x.key === item.key);
          if (idx >= 0) {
            next[idx] = item;
          } else {
            next.push(item);
          }
        }
        return next;
      });
      e.target.value = '';
    } catch (err) {
      setFileError('Failed to read env file.');
    }
  };

  const handleRemoveStaged = (keyToRemove: string) => {
    setStagedEnvs(prev => prev.filter(x => x.key !== keyToRemove));
  };

  return (
    <div className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
      <div className="space-y-3.5 bg-[#0c0c0e]/60 p-4 rounded-xl border border-[#222227]">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-amber-500" />
            Add Environment Variables
          </h4>
          <div className="flex gap-1 bg-[#141418] border border-[#222227] rounded-lg p-0.5 select-none">
            {(['single', 'bulk', 'file'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => { setEnvTab(tab); setFileError(''); }}
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded transition-all capitalize",
                  envTab === tab ? "bg-amber-500 text-black shadow-sm" : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                {tab === 'file' ? 'Upload .env' : tab === 'bulk' ? 'Bulk Import' : tab}
              </button>
            ))}
          </div>
        </div>

        {envTab === 'single' && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="KEY"
              value={singleKey}
              onChange={e => setSingleKey(e.target.value)}
              className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9 font-mono text-xs sm:w-1/3"
            />
            <Input
              placeholder="value"
              value={singleVal}
              onChange={e => setSingleVal(e.target.value)}
              className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9 font-mono text-xs flex-1"
            />
            <select
              value={singleEnv}
              onChange={e => setSingleEnv(e.target.value)}
              className="bg-[#141418] border-[#222227] rounded-md text-zinc-200 text-xs px-2.5 h-9 focus:border-amber-500 outline-none"
            >
              <option value="production">Production</option>
              <option value="preview">Preview</option>
              <option value="development">Development</option>
            </select>
            <Button
              type="button"
              onClick={handleAddSingle}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs h-9 px-4 shrink-0"
            >
              Add
            </Button>
          </div>
        )}

        {envTab === 'bulk' && (
          <div className="space-y-2">
            <textarea
              placeholder={`# Paste .env variables here\nDATABASE_URL=postgresql://...\nAPI_KEY=supersecret`}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              rows={4}
              className="w-full bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 p-2.5 rounded-lg font-mono text-xs focus:ring-0 focus:outline-none"
            />
            <div className="flex justify-between items-center select-none">
              <span className="text-[10px] text-zinc-500">Variables will default to the 'production' environment.</span>
              <Button
                type="button"
                onClick={handleBulkImport}
                className="bg-[#1a1a22] border border-[#33333e] text-zinc-300 hover:text-white text-xs h-8 px-4"
              >
                Parse & Add
              </Button>
            </div>
          </div>
        )}

        {envTab === 'file' && (
          <div className="border border-dashed border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center bg-[#0c0c0e]/30 space-y-3">
            <Upload className="h-8 w-8 text-zinc-650 animate-bounce" />
            <div className="text-center select-none">
              <p className="text-xs font-semibold text-zinc-300">Choose a `.env` file to upload</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Loads all KEY=VALUE pairs immediately</p>
            </div>
            <div className="relative select-none">
              <input
                type="file"
                accept=".env,.txt"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button type="button" className="bg-[#1a1a22] border border-[#33333e] text-zinc-300 hover:text-white text-xs h-8 px-4">
                Select File
              </Button>
            </div>
          </div>
        )}

        {fileError && (
          <p className="text-[11px] text-red-400 font-semibold">{fileError}</p>
        )}
      </div>

      <div className="space-y-3.5 bg-[#0c0c0e]/60 p-4 rounded-xl border border-[#222227]">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Staged Environment Variables ({stagedEnvs.length})
          </h4>
          {stagedEnvs.length > 0 && (
            <button
              type="button"
              onClick={() => setStagedEnvs([])}
              className="text-red-500 hover:text-red-400 transition-colors normal-case font-normal text-[10px] select-none"
            >
              Clear All
            </button>
          )}
        </div>

        {stagedEnvs.length === 0 ? (
          <div className="text-center py-6 text-zinc-500 text-xs italic select-none">
            No variables staged yet. Add some above.
          </div>
        ) : (
          <div className="max-h-[200px] overflow-y-auto border border-[#1e1e24] rounded-lg bg-[#0c0c0e]">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-[#1c1c21] bg-zinc-900/30 text-zinc-500 uppercase tracking-wider font-semibold select-none">
                  <th className="py-2 px-3">Key</th>
                  <th className="py-2 px-3">Value</th>
                  <th className="py-2 px-3">Env</th>
                  <th className="py-2 px-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#16161a] font-mono">
                {stagedEnvs.map(env => (
                  <tr key={env.key} className="hover:bg-zinc-900/10 text-zinc-350 group">
                    <td className="py-1.5 px-3 font-semibold truncate max-w-[150px]">{env.key}</td>
                    <td className="py-1.5 px-3 truncate max-w-[200px] text-zinc-500">{env.value}</td>
                    <td className="py-1.5 px-3 select-none">
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight",
                        env.environment === 'production' ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/10" :
                        env.environment === 'preview' ? "bg-amber-950/40 text-amber-400 border border-amber-900/10" :
                        "bg-orange-950/40 text-orange-400 border border-orange-900/10"
                      )}>
                        {env.environment || 'production'}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveStaged(env.key)}
                        className="text-zinc-650 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
