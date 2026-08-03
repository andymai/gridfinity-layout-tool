import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store';
import { getCellSizeY } from '@/core/constants';
import { effectiveGridUnitMmY } from '@/core/types';
import { drawerFrameOverhang } from '@/shared/utils/outlineFrame';

export interface OutlineOverhangInsets {
  /** px the shape reaches left of the grid box. */
  readonly left: number;
  /** px the shape reaches above the grid box (`back` in y-up plate terms). */
  readonly top: number;
}

/**
 * Gutter the layout must reserve around the grid for a custom perimeter that
 * the grid frame draws outside it (#3169).
 *
 * The grid is rendered fixed and the shape carries the frame translation, so a
 * grid shift toward an edge the shape already touches puts part of the
 * perimeter left of / below the grid box. `DrawerOutlineOverlay` already grows
 * its own SVG to cover that (#3107) and positions it at a negative offset —
 * but the grid lives in an `overflow-auto` scroll container, and a browser
 * will not scroll into negative overflow, so without reserved space the
 * protruding side is simply clipped (and overlaps the row labels on the way).
 *
 * Only the two clipping directions are reported. The overlay's SVG is placed
 * at `left: gap + offsetX, top: gap + offsetY`, and only a left (`left`) or
 * top (`back`) reach drives those negative; a right/bottom reach just makes
 * the SVG larger, which extends the scrollable area and stays reachable.
 */
export function useOutlineOverhangInsets(cellSize: number, gap: number): OutlineOverhangInsets {
  const { drawer, baseplateParams, gridUnitMm, gridUnitMmY } = useLayoutStore(
    useShallow((s) => ({
      drawer: s.layout.drawer,
      baseplateParams: s.layout.baseplateParams,
      gridUnitMm: s.layout.gridUnitMm,
      gridUnitMmY: effectiveGridUnitMmY(s.layout),
    }))
  );

  if (drawer.outline === undefined) return NONE;

  const overhang = drawerFrameOverhang(drawer, baseplateParams, gridUnitMm, gridUnitMmY);
  if (overhang.left === 0 && overhang.back === 0) return NONE;

  // One grid unit spans `cellSize + gap` px; the depth axis uses the
  // non-square Y pitch and row size (both equal the X values on a square grid).
  const cellSizeY = getCellSizeY(cellSize, gridUnitMm, gridUnitMmY);
  return {
    left: Math.ceil((overhang.left / gridUnitMm) * (cellSize + gap)),
    top: Math.ceil((overhang.back / gridUnitMmY) * (cellSizeY + gap)),
  };
}

const NONE: OutlineOverhangInsets = { left: 0, top: 0 };
