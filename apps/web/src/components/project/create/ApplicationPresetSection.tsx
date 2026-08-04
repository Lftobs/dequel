import { FrameworkPreset } from '../../../utils/presets';
import { FrameworkSelect } from '../../ui/FrameworkSelect';
import { Layers, Sparkles } from 'lucide-react';

interface ApplicationPresetSectionProps {
  selectedPresetId: string;
  onSelectPreset: (preset: FrameworkPreset) => void;
}

export function ApplicationPresetSection({
  selectedPresetId,
  onSelectPreset,
}: ApplicationPresetSectionProps) {
  return (
    <div className="space-y-4 bg-[#0d0d10] border border-[#1f1f26] p-5 sm:p-6 rounded-2xl shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Layers className="h-4 w-4 text-orange-500" />
            Application Preset
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Select your framework to automatically pre-map build commands and runtime options.
          </p>
        </div>
        <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20">
          <Sparkles className="h-3 w-3" />
          Framework Presets
        </span>
      </div>

      {/* Main Framework Dropdown Select */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-zinc-300">
          Framework Preset
        </label>
        <FrameworkSelect
          selectedPresetId={selectedPresetId}
          onSelectPreset={onSelectPreset}
        />
      </div>
    </div>
  );
}
