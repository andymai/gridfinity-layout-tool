/**
 * Red warning frames for cutouts stranded past the board edge. Expands array
 * masters into instances (just the cutout itself when there's no array) and
 * frames each instance that is actually off-board, at its true footprint —
 * keeping the visual in lockstep with `isCutoutOffBoard` detection.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { CellMask } from '@/shared/utils/cellMask';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import type { PreviewMap } from '../useCutoutInteraction';
import { isCutoutOffBoard } from '../offBoardCutouts';
import { getCutoutBounds } from '../maskFit';
import { OffBoardBounds3D } from './OffBoardBounds3D';

interface OffBoardFrames3DProps {
  readonly cutouts: readonly Cutout[];
  readonly offBoardIds: ReadonlySet<string>;
  readonly preview: PreviewMap;
  readonly binWidth: number;
  readonly binDepth: number;
  readonly cellMask?: CellMask;
}

export function OffBoardFrames3D({
  cutouts,
  offBoardIds,
  preview,
  binWidth,
  binDepth,
  cellMask,
}: OffBoardFrames3DProps) {
  // Read straight from the store (like MeshFootprintMesh) so a mesh imprint is
  // re-tested by the same silhouette `offBoardIds` used — otherwise the frames
  // drift out of lockstep with the warning that summons them.
  const meshAssets = useDesignerStore((s) => s.params.meshAssets);
  if (offBoardIds.size === 0) return null;
  const maskCellSize = cellMask
    ? { cellMmX: binWidth / cellMask.cols, cellMmY: binDepth / cellMask.rows }
    : undefined;
  return (
    <>
      {cutouts
        .filter((c) => offBoardIds.has(c.id) && !c.hidden)
        .flatMap((c) =>
          expandCutoutArray({ ...c, ...preview.get(c.id) })
            .filter((inst) =>
              isCutoutOffBoard(inst, binWidth, binDepth, cellMask, maskCellSize, meshAssets)
            )
            .map((inst) => (
              <OffBoardBounds3D key={`offboard-${inst.id}`} bounds={getCutoutBounds(inst)} />
            ))
        )}
    </>
  );
}
