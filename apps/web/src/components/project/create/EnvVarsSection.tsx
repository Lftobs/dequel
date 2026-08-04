import { useState, useRef } from 'react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Key, Plus, Trash2, FileText, Upload, ChevronDown } from 'lucide-react';

export interface StagedEnv {
  key: string;
  value: string;
  environment?: string;
}

interface EnvVarsSectionProps {
  stagedEnvs: StagedEnv[];
  setStagedEnvs: React.Dispatch<React.SetStateAction<StagedEnv[]>>;
}

export function EnvVarsSection({ stagedEnvs, setStagedEnvs }: EnvVarsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [key, setKey] = useState('');
  const [val, setVal] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [mode, setMode] = useState<'single' | 'bulk' | 'file'>('single');
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addEnv = () => {
    if (!key.trim()) return;
    setStagedEnvs((prev) => [...prev, { key: key.trim(), value: val.trim() }]);
    setKey('');
    setVal('');
  };

  const removeEnv = (index: number) => {
    setStagedEnvs((prev) => prev.filter((_, i) => i !== index));
  };

  const parseEnvContent = (content: string) => {
    const lines = content.split(/\r?\n/);
    const newEnvs: StagedEnv[] = [];
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const k = trimmed.slice(0, eqIdx).trim();
        const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (k) newEnvs.push({ key: k, value: v });
      }
    });
    return newEnvs;
  };

  const importBulk = () => {
    if (!bulkText.trim()) return;
    const parsed = parseEnvContent(bulkText);
    setStagedEnvs((prev) => [...prev, ...parsed]);
    setBulkText('');
    setMode('single');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = parseEnvContent(content);
        if (parsed.length === 0) {
          setFileError('No valid KEY=VALUE pairs found in file.');
        } else {
          setStagedEnvs((prev) => [...prev, ...parsed]);
          setMode('single');
        }
      } catch {
        setFileError('Failed to parse file content.');
      }
    };
    reader.onerror = () => setFileError('Error reading file.');
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 bg-[#0d0d10] border border-[#1f1f26] p-5 sm:p-6 rounded-2xl shadow-lg">
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Key className="h-4 w-4 text-orange-500" />
            Environment Variables ({stagedEnvs.length})
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Add environment secrets, API keys, and configuration variables.
          </p>
        </div>
        <button
          type="button"
          className="p-1.5 rounded-lg bg-[#14141a] border border-[#22222c] text-zinc-400 hover:text-white"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              isExpanded ? 'transform rotate-180 text-orange-400' : ''
            }`}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-2 border-t border-[#1a1a22]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                mode === 'single'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'bg-[#14141a] text-zinc-400 border border-[#22222c]'
              }`}
            >
              Key-Value Builder
            </button>
            <button
              type="button"
              onClick={() => setMode('bulk')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                mode === 'bulk'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'bg-[#14141a] text-zinc-400 border border-[#22222c]'
              }`}
            >
              Paste .env Content
            </button>
            <button
              type="button"
              onClick={() => setMode('file')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                mode === 'file'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'bg-[#14141a] text-zinc-400 border border-[#22222c]'
              }`}
            >
              Upload .env File
            </button>
          </div>

          {mode === 'single' ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="KEY (e.g. DATABASE_URL)"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="bg-[#121215] border-[#22222a] text-xs font-mono"
              />
              <Input
                placeholder="VALUE"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                className="bg-[#121215] border-[#22222a] text-xs font-mono"
              />
              <Button
                type="button"
                onClick={addEnv}
                disabled={!key.trim()}
                className="bg-orange-600 hover:bg-orange-500 text-white shrink-0 text-xs px-4"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          ) : mode === 'bulk' ? (
            <div className="space-y-2">
              <textarea
                rows={4}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'DATABASE_URL="postgresql://..."\nAPI_KEY="sk_12345"'}
                className="w-full bg-[#121215] border border-[#22222a] rounded-xl p-3 text-xs font-mono text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-orange-500"
              />
              <Button
                type="button"
                onClick={importBulk}
                disabled={!bulkText.trim()}
                className="bg-orange-600 hover:bg-orange-500 text-white text-xs px-4"
              >
                <FileText className="h-4 w-4 mr-1" />
                Parse & Import
              </Button>
            </div>
          ) : (
            <div className="space-y-2 p-4 border border-dashed border-[#22222a] rounded-xl bg-[#121215] text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".env,.env.local,.env.production,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload className="h-6 w-6 text-orange-400 mx-auto" />
              <p className="text-xs text-zinc-300 font-semibold">Select a `.env` file to upload</p>
              <p className="text-[11px] text-zinc-500">Supports standard .env formatting with key=value lines</p>
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#1c1c24] hover:bg-[#252530] text-zinc-200 text-xs border border-[#2e2e3a] mt-2"
              >
                Browse Files
              </Button>
              {fileError && <p className="text-xs text-red-400 mt-2">{fileError}</p>}
            </div>
          )}

          {stagedEnvs.length > 0 && (
            <div className="space-y-1.5 pt-2 max-h-48 overflow-y-auto pr-1">
              {stagedEnvs.map((env, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#121215] border border-[#22222a] text-xs font-mono"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-orange-400 font-bold">{env.key}</span>
                    <span className="text-zinc-500">=</span>
                    <span className="text-zinc-300 truncate">{env.value}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEnv(i)}
                    className="text-zinc-500 hover:text-red-400 p-1 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
