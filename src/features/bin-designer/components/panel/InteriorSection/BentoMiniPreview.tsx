/**
 * Non-interactive thumbnail of the bento layout for the sidebar card:
 * drawn compartments as solid blocks over a faint background lattice, the
 * same visual language as the workspace canvas at postage-stamp size. All
 * editing happens in the workspace — this is a preview, not a surface.
 */

import { useMemo } from 'react';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import {
  getCompartmentRect,
  getDrawnCompartmentIds,
  type CellRect,
} from '@/features/bin-designer/utils/bentoDraw';

export interface BentoMiniPreviewProps {
  readonly compartments: CompartmentConfig;
  /** Bin footprint ratio (width / depth) so the thumbnail keeps proportions. */
  readonly aspectRatio: number;
}

const VIEW_W = 120;

export function BentoMiniPreview({ compartments, aspectRatio }: BentoMiniPreviewProps) {
  const { cols, rows } = compartments;
  const viewH = VIEW_W / Math.max(0.25, Math.min(4, aspectRatio));
  const cellW = VIEW_W / cols;
  const cellH = viewH / rows;

  const drawn = useMemo(() => getDrawnCompartmentIds(compartments), [compartments]);
  const drawnRects = useMemo(
    () =>
      [...drawn]
        .map((id) => getCompartmentRect(compartments, id))
        .filter((rect): rect is CellRect => rect !== null),
    [compartments, drawn]
  );

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${viewH}`}
      className="w-full rounded-md border border-stroke-subtle bg-surface-elevated"
      aria-hidden
      data-testid="bento-mini-preview"
    >
      {/* Background pockets, same visual language as the workspace canvas */}
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const id = compartments.cells[r * cols + c];
          if (drawn.has(id)) return null;
          return (
            <rect
              key={`p${r}-${c}`}
              x={c * cellW + 0.75}
              y={viewH - (r + 1) * cellH + 0.75}
              width={Math.max(0, cellW - 1.5)}
              height={Math.max(0, cellH - 1.5)}
              rx={1}
              className="fill-surface stroke-stroke-subtle"
              strokeWidth={0.5}
            />
          );
        })
      )}
      {drawnRects.map((rect, i) => (
        <rect
          key={i}
          x={rect.col * cellW + 1}
          // Row 0 = front = bottom of the thumbnail.
          y={viewH - (rect.row + rect.h) * cellH + 1}
          width={Math.max(0, rect.w * cellW - 2)}
          height={Math.max(0, rect.h * cellH - 2)}
          rx={1.5}
          className="fill-accent/25 stroke-accent/70"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}
