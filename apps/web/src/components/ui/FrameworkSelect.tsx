import { useState, useRef, useEffect } from 'react';
import { FrameworkPreset, FRAMEWORK_PRESETS } from '../../utils/presets';
import { getFrameworkLogo } from '../logos/FrameworkLogos';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FrameworkSelectProps {
  selectedPresetId: string;
  onSelectPreset: (preset: FrameworkPreset) => void;
  className?: string;
}

export function FrameworkSelect({ selectedPresetId, onSelectPreset, className }: FrameworkSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedPreset =
    FRAMEWORK_PRESETS.find((p) => p.id === selectedPresetId) ||
    FRAMEWORK_PRESETS.find((p) => p.id === 'other') ||
    FRAMEWORK_PRESETS[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPresets = FRAMEWORK_PRESETS.filter((preset) =>
    preset.name.toLowerCase().includes(search.toLowerCase()) ||
    preset.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl',
          'bg-[#121215] border border-[#22222a] hover:border-orange-500/40 transition-all text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20',
          isOpen && 'border-orange-500/60 ring-2 ring-orange-500/20 bg-[#16161c]'
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-[#1a1a22] border border-[#2a2a36] shrink-0 text-zinc-100 flex items-center justify-center">
            {getFrameworkLogo(selectedPreset.icon || selectedPreset.name, 'h-5 w-5')}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-zinc-100 truncate">{selectedPreset.name}</span>
              <span
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0',
                  selectedPreset.projectType === 'web'
                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                )}
              >
                {selectedPreset.projectType === 'web' ? 'Web Service' : 'Static Site'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 truncate mt-0.5">{selectedPreset.description}</p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-zinc-400 transition-transform shrink-0',
            isOpen && 'transform rotate-180 text-orange-400'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 rounded-xl bg-[#121215] border border-[#24242e] shadow-2xl shadow-black/80 overflow-hidden backdrop-blur-xl animate-in fade-in-50 zoom-in-95">
          <div className="p-2.5 border-b border-[#20202a] flex items-center gap-2 bg-[#16161d]">
            <Search className="h-4 w-4 text-zinc-500 shrink-0 ml-1" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search frameworks (Next.js, Vite, Astro, Express...)"
              className="w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none py-1"
              autoFocus
            />
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            {filteredPresets.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500">No framework presets match "{search}"</div>
            ) : (
              filteredPresets.map((preset) => {
                const isSelected = preset.id === selectedPreset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onSelectPreset(preset);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all group',
                      isSelected
                        ? 'bg-orange-500/10 border border-orange-500/30 text-zinc-100'
                        : 'hover:bg-[#1c1c24] text-zinc-300 border border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'p-2 rounded-lg shrink-0 flex items-center justify-center transition-colors',
                          isSelected
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : 'bg-[#181820] text-zinc-300 group-hover:bg-[#22222d] group-hover:text-white'
                        )}
                      >
                        {getFrameworkLogo(preset.icon || preset.name, 'h-4 w-4')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'font-medium text-xs truncate',
                              isSelected ? 'text-orange-400 font-bold' : 'text-zinc-200 group-hover:text-white'
                            )}
                          >
                            {preset.name}
                          </span>
                          <span
                            className={cn(
                              'text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
                              preset.projectType === 'web'
                                ? 'bg-orange-500/10 text-orange-400'
                                : 'bg-emerald-500/10 text-emerald-400'
                            )}
                          >
                            {preset.projectType === 'web' ? 'Web' : 'Static'}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">{preset.description}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-orange-400 shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
