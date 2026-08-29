/**
 * Per-compartment cavity size drawn on the grid, in mm.
 *
 * Reads `compartmentCavityExact`, so a wall dragged off its grid line changes
 * the number: on a bento the nominal grid size would describe a part nobody is
 * going to get. Suppressed for compartments too small to hold the text, which
 * is also roughly the point where the number stops being readable anyway.
 */

import { useMemo } from 'react';
import {
  compartmentCavityExact,
  formatCompactMm,
} from '@/features/bin-designer/utils/compartmentDimensions';
import type { CompartmentConfig } from '@/features/bin-designer/types';

export interface CompartmentSizeOverlayProps {
  readonly compartments: CompartmentConfig;
  readonly interiorW: number;
  readonly interiorD: number;
  /** Drawn size of the grid in CSS pixels, used to hide labels that won't fit. */
  readonly boxWidthPx: number;
  readonly boxHeightPx: number;
}

/** Below this the label overlaps its own compartment walls. */
const MIN_LABEL_WIDTH_PX = 54;
const MIN_LABEL_HEIGHT_PX = 26;

export function CompartmentSizeOverlay({
  compartments,
  interiorW,
  interiorD,
  boxWidthPx,
  boxHeightPx,
}: CompartmentSizeOverlayProps) {
  const { cols, rows } = compartments;

  const labels = useMemo(() => {
    const seen = new Set<number>();
    const out: Array<{ id: number; left: number; top: number; text: string }> = [];

    for (const id of compartments.cells) {
      if (seen.has(id)) continue;
      seen.add(id);

      const cavity = compartmentCavityExact(compartments, id, interiorW, interiorD);
      if (!cavity) continue;

      const spanCols = cavity.maxCol - cavity.minCol + 1;
      const spanRows = cavity.maxRow - cavity.minRow + 1;
      if ((spanCols / cols) * boxWidthPx < MIN_LABEL_WIDTH_PX) continue;
      if ((spanRows / rows) * boxHeightPx < MIN_LABEL_HEIGHT_PX) continue;

      const centreCol = (cavity.minCol + cavity.maxCol + 1) / 2;
      const centreRow = (cavity.minRow + cavity.maxRow + 1) / 2;
      out.push({
        id,
        left: (centreCol / cols) * 100,
        // Row 0 is the front (bottom of the UI), so top% counts down from 100.
        top: (1 - centreRow / rows) * 100,
        text: `${formatCompactMm(cavity.width)} × ${formatCompactMm(cavity.depth)}`,
      });
    }

    return out;
  }, [compartments, interiorW, interiorD, boxWidthPx, boxHeightPx, cols, rows]);

  if (labels.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-2 z-20" aria-hidden="true">
      {labels.map(({ id, left, top, text }) => (
        <span
          key={id}
          className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-surface/70 px-1 text-micro tabular-nums text-content-secondary"
          style={{ left: `${left}%`, top: `${top}%` }}
        >
          {text}
        </span>
      ))}
    </div>
  );
}
