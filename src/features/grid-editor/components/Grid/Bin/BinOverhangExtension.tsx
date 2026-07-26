/**
 * Visual extension of a bin past its grid footprint.
 *
 * Covers both sources of overhang (see `@/shared/utils/drawerMargin`): the
 * drawer-fit margin a bin claims on padded drawer edges (#2462), and an explicit
 * per-placement overhang authored by "Expand to Fit". Rendered as a
 * `pointer-events: none` child behind the bin's own background (negative insets
 * + `zIndex: -1`): the portion over the bin is hidden by its background (same
 * color), only the extension slice shows, and the bin's label/badges stay on
 * top. Purely visual — it never changes the interactive box, so drag/resize/
 * hit-testing are untouched.
 *
 * The extension is deliberately seamless: an expanded bin should read as its
 * true outer footprint, because that is what gets printed. `showSocketEdge`
 * (driven by selection/hover) reveals a dashed outline at the footprint
 * boundary so the user can still see where the feet actually end — the
 * mechanics stay discoverable without cluttering the resting view.
 */

import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store';
import { binOverhangSides } from '@/shared/utils/drawerMargin';
import type { Bin, Drawer } from '@/core/types';
import type { CategoryPatternStyle } from './categoryPatterns';

interface BinOverhangExtensionProps {
  bin: Bin;
  drawer: Drawer;
  cellSize: number;
  gap: number;
  /** The bin's category color — the extension paints the same so it reads as one bin. */
  color: string;
  /** Category pattern overlay, when enabled — kept in sync with the bin's fill
   * so the accessibility texture covers the whole visible footprint, not just
   * the interactive box. */
  patternStyle?: CategoryPatternStyle | null;
  /** Outline the grid footprint so the feet position is visible (selection/hover). */
  showSocketEdge?: boolean;
  /** Contrast-safe color for that outline — the bin's own secondary text color. */
  socketEdgeColor?: string;
}

export function BinOverhangExtension({
  bin,
  drawer,
  cellSize,
  gap,
  color,
  patternStyle,
  showSocketEdge,
  socketEdgeColor,
}: BinOverhangExtensionProps) {
  const { baseplate, gridUnitMm } = useLayoutStore(
    useShallow((s) => ({
      baseplate: s.layout.baseplateParams,
      gridUnitMm: s.layout.gridUnitMm,
    }))
  );

  const sides = binOverhangSides(bin, drawer, baseplate);
  if (sides.left + sides.right + sides.front + sides.back <= 0) return null;

  // One grid unit spans `cellSize + gap` px; overhang is a fraction of a unit.
  const pxPerUnit = cellSize + gap;
  const toPx = (mm: number): number => (mm / gridUnitMm) * pxPerUnit;

  return (
    <>
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
          ...(patternStyle ?? {}),
          zIndex: -1,
        }}
      />
      {showSocketEdge === true && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-sm"
          style={{ border: `1px dashed ${socketEdgeColor ?? 'currentColor'}`, opacity: 0.7 }}
        />
      )}
    </>
  );
}
