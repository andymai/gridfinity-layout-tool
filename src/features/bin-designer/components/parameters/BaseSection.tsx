/**
 * Base options section: base style selector, magnet depth, stacking lip toggle.
 * Conditionally shows magnet/screw-specific controls based on selected style.
 */

import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { Checkbox } from '@/shared/components/Checkbox';
import { SliderInput } from '../controls/SliderInput';
import type { BaseStyle, BaseConfig } from '@/features/bin-designer/types';

const BASE_STYLES: Array<{ value: BaseStyle; label: string; description: string }> = [
  { value: 'standard', label: 'Standard', description: 'Flat bottom' },
  { value: 'magnet', label: 'Magnet', description: '6mm holes' },
  { value: 'screw', label: 'Screw', description: 'M3 holes' },
  { value: 'weighted', label: 'Weighted', description: 'Thick base' },
];

export function BaseSection() {
  const { base, setParam } = useDesignerStore(
    useShallow((s) => ({
      base: s.params.base,
      setParam: s.setParam,
    }))
  );

  const updateBase = (partial: Partial<BaseConfig>) => {
    setParam('base', { ...base, ...partial });
  };

  return (
    <div className="space-y-4">
      {/* Style selector */}
      <div>
        <label className="mb-2 block text-xs font-medium text-content-secondary">
          Attachment Style
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {BASE_STYLES.map(({ value, label, description }) => (
            <button
              key={value}
              type="button"
              onClick={() => updateBase({ style: value })}
              className={`rounded-md border px-2 py-1.5 text-left transition-colors ${
                base.style === value
                  ? 'border-accent bg-surface text-content ring-1 ring-accent/30'
                  : 'border-stroke-subtle bg-surface text-content-secondary hover:border-stroke hover:bg-surface-hover'
              }`}
              aria-pressed={base.style === value}
            >
              <span className="block text-xs font-medium">{label}</span>
              <span className="block text-[10px] text-content-tertiary">{description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Magnet depth (only for magnet style) */}
      {base.style === 'magnet' && (
        <SliderInput
          label="Magnet Depth"
          value={base.magnetDepth}
          onChange={(v) => updateBase({ magnetDepth: v })}
          min={DESIGNER_CONSTRAINTS.MAGNET_MIN_DEPTH}
          max={DESIGNER_CONSTRAINTS.MAGNET_MAX_DEPTH}
          step={0.1}
          unit="mm"
        />
      )}

      {/* Screw info (only for screw style) */}
      {base.style === 'screw' && (
        <div className="rounded-md bg-surface-elevated px-3 py-2">
          <span className="text-xs text-content-secondary">
            M3 screw holes ({base.screwDiameter}mm diameter)
          </span>
        </div>
      )}

      {/* Stacking lip toggle */}
      <Checkbox
        checked={base.stackingLip}
        onChange={(checked) => updateBase({ stackingLip: checked })}
        label="Stacking lip"
        ariaLabel="Enable stacking lip"
      />
    </div>
  );
}
