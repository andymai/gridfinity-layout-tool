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

  const drawnRects = useMemo(() => {
    const drawn = getDrawnCompartmentIds(compartments);
    return [...drawn]
      .map((id) => getCompartmentRect(compartments, id))
      .filter((rect): rect is CellRect => rect !== null);
  }, [compartments]);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${viewH}`}
      className="w-full rounded-md border border-stroke-subtle bg-surface-elevated"
      aria-hidden
      data-testid="bento-mini-preview"
    >
      {Array.from({ length: cols - 1 }, (_, i) => (
        <line
          key={`v${i}`}
          x1={(i + 1) * cellW}
          y1={0}
          x2={(i + 1) * cellW}
          y2={viewH}
          className="stroke-stroke-subtle"
          strokeWidth={0.75}
          strokeDasharray="1.5 3"
        />
      ))}
      {Array.from({ length: rows - 1 }, (_, i) => (
        <line
          key={`h${i}`}
          x1={0}
          y1={(i + 1) * cellH}
          x2={VIEW_W}
          y2={(i + 1) * cellH}
          className="stroke-stroke-subtle"
          strokeWidth={0.75}
          strokeDasharray="1.5 3"
        />
      ))}
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
