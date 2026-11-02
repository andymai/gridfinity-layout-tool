import type { Cutout } from '@/features/bin-designer/types';
import type { PreviewMap } from '../useCutoutInteraction';
import { getCutoutBounds } from '../maskFit';
import { placedCopies } from '../pocketChecks';
import { ISSUE_COLOR } from './constants';
import { OffBoardBounds3D } from './OffBoardBounds3D';

interface IssueFrames3DProps {
  readonly cutouts: readonly Cutout[];
  /** Placed copies a pocket check names: a repeat copy as `${master}::a${i}`. */
  readonly instanceIds: ReadonlySet<string>;
  readonly preview: PreviewMap;
}

export function IssueFrames3D({ cutouts, instanceIds, preview }: IssueFrames3DProps) {
  if (instanceIds.size === 0) return null;
  // Expanded exactly as the checks expand them, so a copy a group inherits
  // from another member's repeat carries the same id here as in the issue.
  const live = cutouts.map((c) => ({ ...c, ...preview.get(c.id) }));
  return (
    <>
      {placedCopies(live)
        .filter(({ cutout }) => instanceIds.has(cutout.id))
        .map(({ cutout }) => (
          <OffBoardBounds3D
            key={`issue-${cutout.id}`}
            bounds={getCutoutBounds(cutout)}
            color={ISSUE_COLOR}
            dashed
          />
        ))}
    </>
  );
}
