/**
 * Compact "apply a common hardware size" picker. Acts like an action menu
 * (resets after each pick) rather than a stateful select, so it reads as
 * "jump to a spec size" — e.g. 1/4" hex or a socket drive.
 */

import { Select } from '@/design-system';
import type { SelectOption } from '@/design-system';
import type { CutoutSizePreset } from './cutoutShapePresets';

interface CutoutPresetMenuProps {
  readonly presets: readonly CutoutSizePreset[];
  readonly label: string;
  readonly onPick: (mm: number) => void;
  readonly disabled?: boolean;
}

function toOptions(presets: readonly CutoutSizePreset[]): SelectOption[] {
  return presets.map((p) => ({ id: p.id, name: p.label }));
}

export function CutoutPresetMenu({ presets, label, onPick, disabled }: CutoutPresetMenuProps) {
  return (
    <div className="flex items-center gap-1.5">
      <svg
        className="h-3.5 w-3.5 flex-shrink-0 text-content-tertiary"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {/* Ruler / sizing glyph */}
        <rect x="1" y="4.5" width="12" height="5" rx="1" />
        <path d="M4 4.5v2M7 4.5v2.6M10 4.5v2" />
      </svg>
      <div className="min-w-0 flex-1">
        <Select
          aria-label={label}
          placeholder={label}
          value=""
          options={toOptions(presets)}
          onValueChange={(id) => {
            const preset = presets.find((p) => p.id === id);
            if (preset) onPick(preset.mm);
          }}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
