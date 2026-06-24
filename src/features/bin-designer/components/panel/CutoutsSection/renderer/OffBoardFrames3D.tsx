/**
 * Red warning frames for cutouts stranded past the board edge. Expands array
 * masters into instances (just the cutout itself when there's no array) and
 * frames each instance that is actually off-board, at its true footprint —
 * keeping the visual in lockstep with `isCutoutOffBoard` detection.
 */

import type { Cutout } from '@/features/bin-designer/types';
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
            .filter((inst) => isCutoutOffBoard(inst, binWidth, binDepth, cellMask, maskCellSize))
            .map((inst) => (
              <OffBoardBounds3D key={`offboard-${inst.id}`} bounds={getCutoutBounds(inst)} />
            ))
        )}
    </>
  );
}
