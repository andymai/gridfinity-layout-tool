/**
 * Red warning frames for cutouts the generator will clip. Expands array masters
 * into instances (just the cutout itself when there's no array) and frames each
 * instance that is actually out of bounds, at its true footprint — keeping the
 * visual in lockstep with `isCutoutOffBoard` detection.
 *
 * "Out of bounds" follows the board: past the rectangle's edge, outside a custom
 * outline's filled region, or — on the lid — outside the rounded window or over
 * a retention magnet's boss.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { CellMask } from '@/shared/utils/cellMask';
import type { LidCutoutWindow } from '@/shared/utils/lidCutoutPlan';
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
  readonly lidWindow?: LidCutoutWindow | null;
}

export function OffBoardFrames3D({
  cutouts,
  offBoardIds,
  preview,
  binWidth,
  binDepth,
  cellMask,
  lidWindow,
}: OffBoardFrames3DProps) {
  // Read straight from the store (like MeshFootprintMesh) so a mesh imprint is
  // re-tested by the same silhouette `offBoardIds` used — otherwise the frames
  // drift out of lockstep with the warning that summons them.
  const meshAssets = useDesignerStore((s) => s.params.meshAssets);
  if (offBoardIds.size === 0) return null;
  // Rebuilt rather than passed: this component re-tests each instance against
  // the LIVE drag preview, so it needs the board itself, not the verdict.
  const board = {
    width: binWidth,
    depth: binDepth,
    mask: cellMask,
    cellSize: cellMask
      ? { cellMmX: binWidth / cellMask.cols, cellMmY: binDepth / cellMask.rows }
      : undefined,
    lidWindow: lidWindow ?? undefined,
    meshAssets,
  };
  return (
    <>
      {cutouts
        .filter((c) => offBoardIds.has(c.id) && !c.hidden)
        .flatMap((c) =>
          expandCutoutArray({ ...c, ...preview.get(c.id) })
            .filter((inst) => isCutoutOffBoard(inst, board))
            .map((inst) => (
              <OffBoardBounds3D key={`offboard-${inst.id}`} bounds={getCutoutBounds(inst)} />
            ))
        )}
    </>
  );
}
