import type { Cutout } from '@/features/bin-designer/types';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import type { PreviewMap } from '../useCutoutInteraction';
import { getCutoutBounds } from '../maskFit';
import { ISSUE_COLOR } from './constants';
import { OffBoardBounds3D } from './OffBoardBounds3D';

interface IssueFrames3DProps {
  readonly cutouts: readonly Cutout[];
  /** Placed copies a pocket check names: a repeat copy as `${master}::a${i}`. */
  readonly instanceIds: ReadonlySet<string>;
  readonly preview: PreviewMap;
}

/** A dashed frame around each placed copy a pocket check names, following live drags. */
export function IssueFrames3D({ cutouts, instanceIds, preview }: IssueFrames3DProps) {
  if (instanceIds.size === 0) return null;
  return (
    <>
      {cutouts
        .filter((c) => !c.hidden)
        .flatMap((c) =>
          expandCutoutArray({ ...c, ...preview.get(c.id) })
            .filter((inst) => instanceIds.has(inst.id))
            .map((inst) => (
              <OffBoardBounds3D
                key={`issue-${inst.id}`}
                bounds={getCutoutBounds(inst)}
                color={ISSUE_COLOR}
                dashed
              />
            ))
        )}
    </>
  );
}
