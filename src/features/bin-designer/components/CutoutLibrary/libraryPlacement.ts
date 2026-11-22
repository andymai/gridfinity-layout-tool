/** Where a library item lands while its ghost follows the cursor. */

import type { Cutout } from '@/features/bin-designer/types';
import type { MeshAssetEntry } from '@/shared/generation/meshAsset';
import type { CutoutLibraryContent } from '@/features/bin-designer/library/libraryTypes';
import { contentBounds, placeLibraryContent } from './libraryContent';

export interface LibraryGhost {
  /** The item centred on the origin, for the ghost to move as one piece. */
  readonly cutouts: readonly Cutout[];
  readonly meshAssets: Readonly<Record<string, MeshAssetEntry>>;
  readonly width: number;
  readonly depth: number;
}

export function ghostOf(content: CutoutLibraryContent): LibraryGhost | null {
  const box = contentBounds(content.params.cutouts);
  if (!box) return null;
  let next = 0;
  const id = () => `ghost-${++next}`;
  const placed = placeLibraryContent(content, {
    itemId: 'ghost',
    at: { x: 0, y: 0 },
    newCutoutId: id,
    newGroupId: id,
  });
  return {
    cutouts: placed.cutouts,
    meshAssets: placed.meshAssets,
    width: box.maxX - box.minX,
    depth: box.maxY - box.minY,
  };
}

function axisCentre(cursor: number, size: number, board: number, grid: number | null): number {
  if (size >= board) return board / 2;
  const start =
    grid !== null && grid > 0 ? Math.round((cursor - size / 2) / grid) * grid : cursor - size / 2;
  return Math.min(Math.max(start, 0), board - size) + size / 2;
}

/**
 * The middle of the item under `cursor`: its corner on the grid when snapping
 * is on, and kept on the board when it fits there. An item larger than the
 * board sits in its middle, where the off-board warning offers the fix.
 */
export function placementCentre(
  cursor: { readonly x: number; readonly y: number },
  ghost: Pick<LibraryGhost, 'width' | 'depth'>,
  board: { readonly width: number; readonly depth: number },
  grid: number | null
): { x: number; y: number } {
  return {
    x: axisCentre(cursor.x, ghost.width, board.width, grid),
    y: axisCentre(cursor.y, ghost.depth, board.depth, grid),
  };
}
