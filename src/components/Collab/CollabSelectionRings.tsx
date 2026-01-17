/**
 * Overlay component for rendering remote user selection rings.
 *
 * Shows colored rings around bins that other users have selected,
 * similar to Figma's multi-user selection visualization.
 *
 * Features:
 * - Colored rings in each user's assigned color
 * - Multiple users selecting same bin shows multiple rings
 * - Auto-clears when user disconnects (Liveblocks handles presence cleanup)
 * - Memoized for performance with many selections
 */

import { useMemo } from 'react';
import { useOthers } from '../../liveblocks.config';
import { useLayoutStore, useUIStore } from '../../core/store';
import { getBaseCellSize, STAGING_ID } from '../../core/constants';
import { useResponsive } from '../../hooks/useResponsive';

interface CollabSelectionRingsProps {
  /** Optional className for the container */
  className?: string;
}

interface SelectionRing {
  /** Bin ID this ring is for */
  binId: string;
  /** Connection ID of the user who selected it */
  userId: number;
  /** CSS Grid column start (1-based) */
  gridCol: number;
  /** Number of columns this bin spans */
  gridColSpan: number;
  /** CSS Grid row start (1-based, from top) */
  gridRowStart: number;
  /** Number of rows this bin spans */
  gridRowSpan: number;
  /** User's assigned color */
  color: string;
}

/**
 * Renders colored selection rings around bins selected by remote users.
 *
 * Uses CSS Grid positioning (same as Bin.tsx) for accurate overlay alignment.
 */
export function CollabSelectionRings({ className }: CollabSelectionRingsProps) {
  const others = useOthers();
  const bins = useLayoutStore((state) => state.layout.bins);
  const drawer = useLayoutStore((state) => state.layout.drawer);
  const zoom = useUIStore((state) => state.zoom);
  const { viewportWidth } = useResponsive();

  const cellSize = Math.round(getBaseCellSize(viewportWidth) * zoom);
  const gap = 1;

  // Calculate grid dimensions
  const integerWidth = Math.ceil(drawer.width);
  const integerDepth = Math.ceil(drawer.depth);

  // Calculate ring positions for all users' selections
  const allRings = useMemo(() => {
    const rings: SelectionRing[] = [];

    for (const { connectionId, presence } of others) {
      const { selectedBinIds = [], color } = presence;
      if (selectedBinIds.length === 0) continue;

      for (const binId of selectedBinIds) {
        const bin = bins.find((b) => b.id === binId);
        // Skip if bin not found or in staging
        if (!bin || bin.layerId === STAGING_ID) continue;

        // Calculate CSS Grid positioning (matches Bin.tsx logic)
        // Grid uses 1-based indexing, origin at top-left
        const getCssColForX = (x: number) => Math.floor(x) + 1;
        const getCssRowForY = (y: number) => integerDepth - Math.floor(y + bin.depth - 0.001);

        const startCol = getCssColForX(bin.x);
        const endCol = getCssColForX(bin.x + bin.width - 0.001);
        const topRow = getCssRowForY(bin.y);
        const bottomRow = integerDepth - Math.floor(bin.y) + 1;

        rings.push({
          binId: bin.id,
          userId: connectionId,
          gridCol: startCol,
          gridColSpan: Math.max(1, endCol - startCol + 1),
          gridRowStart: topRow,
          gridRowSpan: Math.max(1, bottomRow - topRow),
          color,
        });
      }
    }

    return rings;
  }, [others, bins, integerDepth]);

  if (allRings.length === 0) {
    return null;
  }

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-[35] ${className ?? ''}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${integerWidth}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${integerDepth}, ${cellSize}px)`,
        gap: `${gap}px`,
        padding: `${gap}px`,
      }}
      aria-hidden="true"
    >
      {allRings.map(({ binId, userId, gridCol, gridColSpan, gridRowStart, gridRowSpan, color }) => (
        <div
          key={`${userId}-${binId}`}
          className="rounded-sm animate-in fade-in duration-200"
          style={{
            gridColumn: `${gridCol} / span ${gridColSpan}`,
            gridRow: `${gridRowStart} / span ${gridRowSpan}`,
            border: `2px solid ${color}`,
            borderRadius: 'var(--radius-sm, 4px)',
            boxShadow: `0 0 0 1px ${color}30, 0 0 12px ${color}40`,
            pointerEvents: 'none',
          }}
        />
      ))}
    </div>
  );
}
