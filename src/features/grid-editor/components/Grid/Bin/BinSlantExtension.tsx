/**
 * A slanted bin's reach past its grid footprint: the strip its top leans
 * over, and the cells its end support stands on. Purely visual: the
 * interactive box stays the footprint.
 */

import type { CSSProperties } from 'react';
import { useSlantLayout } from '@/shared/hooks/useSlantLayout';
import { effectiveGridUnitMmY } from '@/core/types';
import type { Bin, SlantSide } from '@/core/types';
import { useLayoutStore } from '@/core/store';
import { footprintsOverlap } from '@/shared/utils/collision';
import { placedSlant, rectPastSide } from '@/shared/utils/placedSlant';

interface BinSlantExtensionProps {
  bin: Bin;
  cellSize: number;
  /** Row height in px. Differs from `cellSize` only on a non-square grid. */
  cellSizeY: number;
  gap: number;
  color: string;
}

/** Screen orientation: back (+Y) is up, front (-Y) is down. */
const EDGE: Record<SlantSide, 'top' | 'bottom' | 'left' | 'right'> = {
  back: 'top',
  front: 'bottom',
  left: 'left',
  right: 'right',
};

function stripPast(side: SlantSide, offsetPx: number, lengthPx: number): CSSProperties {
  const across =
    side === 'back' || side === 'front' ? { left: 0, right: 0 } : { top: 0, bottom: 0 };
  const size = side === 'back' || side === 'front' ? { height: lengthPx } : { width: lengthPx };
  return { ...across, ...size, [EDGE[side]]: -(offsetPx + lengthPx) };
}

function openLean(bin: Bin, side: SlantSide, leanU: number, bins: readonly Bin[]): number {
  const lean = rectPastSide(bin, side, leanU);
  let open = leanU;
  for (const other of bins) {
    if (other.id === bin.id || other.layerId !== bin.layerId || !footprintsOverlap(other, lean)) {
      continue;
    }
    const gapU =
      side === 'back'
        ? other.y - (bin.y + bin.depth)
        : side === 'front'
          ? bin.y - (other.y + other.depth)
          : side === 'right'
            ? other.x - (bin.x + bin.width)
            : bin.x - (other.x + other.width);
    open = Math.min(open, Math.max(0, gapU));
  }
  return open;
}

export function BinSlantExtension({
  bin,
  cellSize,
  cellSizeY,
  gap,
  color,
}: BinSlantExtensionProps) {
  const slantLayout = useSlantLayout();
  const slant = placedSlant(bin, slantLayout);
  const pitchMm =
    slant?.plan.axis === 'y' ? effectiveGridUnitMmY(slantLayout) : slantLayout.gridUnitMm;
  // Each bin orders only its own children, so no z-index keeps the strip under
  // a neighbour it leans into: it stops at the first one instead.
  const openU = useLayoutStore((s) =>
    slant ? openLean(bin, slant.plan.side, slant.topOffsetMm / pitchMm, s.layout.bins) : 0
  );
  if (!slant) return null;

  const { side, axis } = slant.plan;
  const unitPx = axis === 'x' ? cellSize + gap : cellSizeY + gap;
  const leanPx = openU * unitPx;
  const support = slant.support;
  const supportLengthPx = support
    ? (axis === 'x' ? support.width : support.depth) * unitPx - gap
    : 0;

  return (
    <>
      {support && (
        <div
          aria-hidden="true"
          data-testid="slant-support-cells"
          className="pointer-events-none absolute rounded-sm"
          style={{
            ...stripPast(side, gap, supportLengthPx),
            border: `1px solid ${color}`,
            backgroundImage: `repeating-linear-gradient(45deg, ${color} 0, ${color} 2px, transparent 2px, transparent 7px)`,
            opacity: 0.8,
            zIndex: -1,
          }}
        />
      )}
      {leanPx > 0 && (
        <div
          aria-hidden="true"
          data-testid="slant-lean"
          className="pointer-events-none absolute"
          style={{
            ...stripPast(side, 0, leanPx),
            backgroundColor: color,
            opacity: 0.35,
            zIndex: -1,
          }}
        />
      )}
    </>
  );
}
