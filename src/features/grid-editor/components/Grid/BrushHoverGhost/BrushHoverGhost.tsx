import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useInteractionStore, useLayoutStore, useHalfGridModeStore } from '@/core/store';
import { useGridCoords, useGridTemplate } from '@/features/grid-editor/hooks';

interface BrushHoverGhostProps {
  gridRef: RefObject<HTMLDivElement | null>;
  cellSize: number;
  gap: number;
}

/**
 * Translucent preview of the loaded brush footprint that follows the cursor
 * while a paint size is active. Rendered as a child of the CSS grid so it can
 * use grid-line placement instead of duplicating the fractional pixel math.
 * Owns its hover state so the parent canvas never re-renders on pointer move.
 */
export function BrushHoverGhost({ gridRef, cellSize, gap }: BrushHoverGhostProps) {
  const { paintSize, interaction } = useInteractionStore(
    useShallow((s) => ({ paintSize: s.paintSize, interaction: s.interaction }))
  );
  const halfGridMode = useHalfGridModeStore((s) => s.halfGridMode);
  const drawer = useLayoutStore((s) => s.layout.drawer);
  const { getGridCoords } = useGridCoords(gridRef);
  const { getCssColForCell, getCssRowForCell, integerWidth, integerDepth } = useGridTemplate({
    drawer,
    cellSize,
    gap,
  });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  // Half-grid mode subdivides cells; the integer-cell footprint would misalign.
  const showGhost = !!paintSize && !interaction && !halfGridMode;

  useEffect(() => {
    if (!showGhost) return;
    const el = gridRef.current;
    if (!el) return;

    const handleMove = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      const target = e.target as HTMLElement;
      // Hovering a bin selects it (not paints), so don't tease a placement there.
      if (target.closest('[data-bin-id]')) {
        setHover(null);
        return;
      }
      const coords = getGridCoords(e.clientX, e.clientY);
      if (!coords) {
        setHover(null);
        return;
      }
      setHover({ x: Math.floor(coords.x), y: Math.floor(coords.y) });
    };
    const handleLeave = () => setHover(null);

    el.addEventListener('pointermove', handleMove);
    el.addEventListener('pointerleave', handleLeave);
    return () => {
      el.removeEventListener('pointermove', handleMove);
      el.removeEventListener('pointerleave', handleLeave);
      setHover(null);
    };
  }, [showGhost, gridRef, getGridCoords]);

  if (!paintSize || interaction || halfGridMode || !hover) return null;

  const { width, depth } = paintSize;
  // A brush larger than the grid can't be placed — nothing to preview.
  if (width > integerWidth || depth > integerDepth) return null;

  const x = Math.max(0, Math.min(hover.x, integerWidth - width));
  const y = Math.max(0, Math.min(hover.y, integerDepth - depth));

  return (
    <div
      data-brush-ghost
      aria-hidden="true"
      style={{
        gridColumn: `${getCssColForCell(x)} / span ${width}`,
        gridRow: `${getCssRowForCell(y + depth - 1)} / span ${depth}`,
        backgroundColor: 'var(--color-accent-muted)',
        border: '2px dashed var(--color-accent)',
        borderRadius: 2,
        pointerEvents: 'none',
        zIndex: 9,
      }}
    />
  );
}
