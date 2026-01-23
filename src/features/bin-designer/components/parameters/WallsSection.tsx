/**
 * Walls section: percentage sliders for wall cutouts on each side.
 * When a wall cutout is between 1-19%, it snaps to 20% minimum.
 */

import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { SliderInput } from '../controls/SliderInput';
import type { WallConfig } from '@/features/bin-designer/types';

const WALL_SIDES: Array<{ key: keyof WallConfig; label: string }> = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' },
];

export function WallsSection() {
  const { walls, style, setParam } = useDesignerStore(
    useShallow((s) => ({
      walls: s.params.walls,
      style: s.params.style,
      setParam: s.setParam,
    }))
  );

  const isVase = style === 'vase';

  const updateWall = (side: keyof WallConfig, rawValue: number) => {
    // Snap: if between 1-19%, snap to minimum 20%
    let value = rawValue;
    if (value > 0 && value < DESIGNER_CONSTRAINTS.MIN_WALL_CUTOUT) {
      value = DESIGNER_CONSTRAINTS.MIN_WALL_CUTOUT;
    }
    setParam('walls', { ...walls, [side]: value });
  };

  if (isVase) {
    return (
      <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
        <p className="text-xs text-amber-400">
          Wall cutouts are not available for vase mode bins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-content-tertiary">
        Set wall height as percentage (0 = full wall, 100 = removed)
      </p>
      {WALL_SIDES.map(({ key, label }) => (
        <SliderInput
          key={key}
          label={label}
          value={walls[key]}
          onChange={(v) => updateWall(key, v)}
          min={0}
          max={DESIGNER_CONSTRAINTS.MAX_WALL_CUTOUT}
          step={5}
          unit="%"
        />
      ))}
    </div>
  );
}
