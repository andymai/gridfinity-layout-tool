/**
 * Style section: visual cards for selecting one of 5 bin style variants.
 * Each style affects wall thickness and available features.
 */

import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { STYLE_WALL_THICKNESS } from '@/features/bin-designer/constants';
import type { BinStyle } from '@/features/bin-designer/types';

const STYLES: Array<{
  value: BinStyle;
  label: string;
  description: string;
  wallMm: number;
}> = [
  { value: 'standard', label: 'Standard', description: 'Default balance of strength and material', wallMm: STYLE_WALL_THICKNESS.standard },
  { value: 'lite', label: 'Lite', description: 'Thin walls, less material', wallMm: STYLE_WALL_THICKNESS.lite },
  { value: 'solid', label: 'Solid', description: 'Thick walls, maximum strength', wallMm: STYLE_WALL_THICKNESS.solid },
  { value: 'vase', label: 'Vase', description: 'Single wall, no interior features', wallMm: STYLE_WALL_THICKNESS.vase },
  { value: 'rugged', label: 'Rugged', description: 'Extra thick with corner reinforcement', wallMm: STYLE_WALL_THICKNESS.rugged },
];

export function StyleSection() {
  const { style, setParam } = useDesignerStore(
    useShallow((s) => ({
      style: s.params.style,
      setParam: s.setParam,
    }))
  );

  return (
    <div className="space-y-1.5">
      {STYLES.map(({ value, label, description, wallMm }) => (
        <button
          key={value}
          type="button"
          onClick={() => setParam('style', value)}
          className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
            style === value
              ? 'border-accent bg-surface ring-1 ring-accent/30'
              : 'border-stroke-subtle bg-surface hover:border-stroke hover:bg-surface-hover'
          }`}
          aria-pressed={style === value}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${style === value ? 'text-content' : 'text-content-secondary'}`}>
              {label}
            </span>
            <span className="text-[10px] tabular-nums text-content-tertiary">
              {wallMm}mm wall
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-content-tertiary">{description}</p>
        </button>
      ))}
    </div>
  );
}
