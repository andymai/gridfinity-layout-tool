/**
 * Decorative extension of a bin into the drawer-fit margin (#2462, Labs
 * `layout_overhang`).
 *
 * When a bin opts into extending (`bin.extendToMargin`) and abuts a padded
 * drawer edge, it visually grows into the DrawerMargin ring on those sides so
 * the layout shows the true footprint. Rendered as a `pointer-events: none`
 * child behind the bin's own background (negative insets + `zIndex: -1`): the
 * portion over the bin is hidden by its background (same color), only the
 * margin slice shows, and the bin's label/badges stay on top. Purely visual —
 * it never changes the interactive box, so drag/resize/hit-testing are
 * untouched.
 */

import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { binMarginSides } from '@/shared/utils/drawerMargin';
import type { Bin, Drawer } from '@/core/types';

interface BinMarginExtensionProps {
  bin: Bin;
  drawer: Drawer;
  cellSize: number;
  gap: number;
  /** The bin's category color — the extension paints the same so it reads as one bin. */
  color: string;
}

export function BinMarginExtension({ bin, drawer, cellSize, gap, color }: BinMarginExtensionProps) {
  const flagOn = useFeatureFlag('layout_overhang');
  const { baseplate, gridUnitMm } = useLayoutStore(
    useShallow((s) => ({
      baseplate: s.layout.baseplateParams,
      gridUnitMm: s.layout.gridUnitMm,
    }))
  );

  if (!flagOn || bin.extendToMargin !== true) return null;
  const sides = binMarginSides(bin, drawer, baseplate);
  if (sides.left + sides.right + sides.front + sides.back <= 0) return null;

  // One grid unit spans `cellSize + gap` px; padding is a fraction of a unit.
  const pxPerUnit = cellSize + gap;
  const toPx = (mm: number): number => (mm / gridUnitMm) * pxPerUnit;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute rounded-sm"
      style={{
        // Screen orientation: back (+Y) is up, front (-Y) is down.
        left: -toPx(sides.left),
        right: -toPx(sides.right),
        top: -toPx(sides.back),
        bottom: -toPx(sides.front),
        backgroundColor: color,
        zIndex: -1,
      }}
    />
  );
}
