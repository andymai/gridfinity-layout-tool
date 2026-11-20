import type { Cutout } from '@/features/bin-designer/types';
import { DEFAULT_GROUP_OP, resolveCutoutLeanDeg } from '@/features/bin-designer/types';
import { mergeCutoutUpdate } from '@/features/bin-designer/store/slices/cutoutSliceHelpers';
import { expandCutoutArray, expandCutoutGroup } from '@/shared/utils/cutoutArray';
import { resolveCutoutDepth, type CutoutDepthFrame } from '@/shared/utils/cutoutDepth';
import { surfaceOpening } from '@/shared/utils/leanedOpening';
import { combineGroupPolygons, type MultiPolygon } from './booleanGeometry';
import type { PreviewMap } from './cutoutInteractionTypes';

interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface PlacedLeanOpening {
  readonly key: string;
  readonly ring: readonly Point2D[];
}

/**
 * Every ring of the hole each leaned pocket leaves in the surface, one set per
 * repeat copy. A group's members combine by the group's own boolean first, so
 * a group with a leaned member shows the group's hole, not each member's.
 */
export function placeLeanOpenings(
  cutouts: readonly Cutout[],
  preview: PreviewMap,
  frame: CutoutDepthFrame
): PlacedLeanOpening[] {
  const live = cutouts
    .map((c) => {
      const patch = preview.get(c.id);
      return patch ? mergeCutoutUpdate(c, patch) : c;
    })
    .filter((c) => c.hidden !== true);
  // The worker clamps the depth to the fill before it turns the cutter.
  const depthOf = (c: Cutout): number => Math.min(resolveCutoutDepth(c, frame), frame.fillDepthMm);
  const leans = (c: Cutout): boolean => resolveCutoutLeanDeg(c) !== 0;

  const placed: PlacedLeanOpening[] = [];
  const add = (key: string, region: MultiPolygon | null): void => {
    region?.forEach((polygon, i) =>
      polygon.forEach((ring, j) =>
        placed.push({ key: `${key}:${i}:${j}`, ring: ring.map(([x, y]) => ({ x, y })) })
      )
    );
  };

  const groups = new Map<string, Cutout[]>();
  for (const c of live) {
    if (c.groupId !== null) {
      groups.set(c.groupId, [...(groups.get(c.groupId) ?? []), c]);
      continue;
    }
    if (!leans(c)) continue;
    for (const copy of c.array ? expandCutoutArray(c) : [c]) {
      const polygon = surfaceOpening(copy, depthOf(copy));
      if (polygon) add(copy.id, [polygon]);
    }
  }
  for (const [groupId, members] of groups) {
    if (!members.some(leans)) continue;
    expandCutoutGroup(members).forEach((copy, k) => {
      const polygons = copy.flatMap((m) => {
        const polygon = surfaceOpening(m, depthOf(m));
        return polygon ? [{ cutout: m, polygon }] : [];
      });
      add(
        `${groupId}:${k}`,
        combineGroupPolygons(polygons, members[0].groupOp ?? DEFAULT_GROUP_OP)
      );
    });
  }
  return placed;
}
