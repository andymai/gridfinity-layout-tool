import type { Cutout } from '@/features/bin-designer/types';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import {
  effectiveSplit,
  fromSplitFrame,
  splitBlockedReason,
  splitSides,
  type SplitPt,
} from '@/shared/utils/cutoutSplit';
import { mergeCutoutUpdate } from '@/features/bin-designer/store/slices/cutoutSliceHelpers';
import type { PreviewMap } from '../useCutoutInteraction';

export interface PlacedSplit {
  readonly key: string;
  readonly ownerId: string;
  readonly from: SplitPt;
  readonly to: SplitPt;
  readonly sideA: SplitPt;
  readonly sideB: SplitPt;
  /** False while the pocket cannot be split, so it cuts whole. */
  readonly live: boolean;
}

/** The area centroid, which a rounded corner's many vertices cannot pull aside. */
function centre(ring: readonly SplitPt[]): SplitPt {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const cross = p.x * q.y - q.x * p.y;
    area += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  if (Math.abs(area) < 1e-9) return ring[0];
  return { x: cx / (3 * area), y: cy / (3 * area) };
}

/** Every split line on the board, one per placed copy, in the editor's frame. */
export function placeSplits(cutouts: readonly Cutout[], preview: PreviewMap): PlacedSplit[] {
  return cutouts.flatMap((stored) => {
    // Merged as a commit merges it, so a dragged path or a resized pocket
    // carries its line along while the gesture is live.
    const live = preview.get(stored.id);
    const c = live ? mergeCutoutUpdate(stored, live) : stored;
    const { split } = c;
    if (!split || c.hidden === true || splitBlockedReason(c) === 'shape') return [];
    return (c.array ? expandCutoutArray(c) : [c]).flatMap((copy): PlacedSplit[] => {
      const sides = splitSides(copy, split);
      if (typeof sides === 'string') return [];
      const world = (p: SplitPt) => fromSplitFrame(copy, p);
      return [
        {
          key: copy.id,
          ownerId: stored.id,
          from: world(sides.ends[0]),
          to: world(sides.ends[1]),
          sideA: world(centre(sides.a)),
          sideB: world(centre(sides.b)),
          live: effectiveSplit(copy) !== null,
        },
      ];
    });
  });
}
