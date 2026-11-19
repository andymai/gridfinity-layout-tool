/**
 * How far a path cut stays off the outer walls: a hair off each wall's face,
 * and clear of the stacking lip's inward jut where the lip stands.
 */

import type { BinParams } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import { lipInnerReachMm } from '@/shared/utils/lipNotchPlan';
import { resolveOverhang } from '@/shared/utils/overhang';
import { resolveBinFloorMm } from '@/shared/utils/slotMath';
import { COPLANAR_OVERLAP, LIP_SUPPORT_DROP, LIP_TAPER_WIDTH } from './generatorConstants';
import { cutoutOvershoot, type CutoutFrame } from './wallCutoutPaths';

/** One level of the clearance a path keeps from the outer walls, in mm in from each inner face. */
export interface WallClearanceSection {
  readonly z: number;
  readonly left: number;
  readonly right: number;
  readonly front: number;
  readonly back: number;
}

interface Level {
  readonly z: number;
  readonly inset: number;
}

/** Room left between a path and the lip's own faces: more than a coplanar overlap. */
const LIP_FACE_CLEARANCE = 0.02;

/**
 * How far a path has to stay off each outer wall, level by level, from the
 * floor to above the rim. Ruled between levels, so each level stands higher
 * than the one before it.
 */
export function pathWallClearance(params: BinParams, frame: CutoutFrame): WallClearanceSection[] {
  // Starts on the floor, so a cut clipped to it never takes the floor slab.
  const zBottom = resolveBinFloorMm(params) + COPLANAR_OVERLAP;
  const zTop = frame.wallHeight + cutoutOvershoot(frame.collarHeight, frame.hasLip) + 1;
  const taper = resolveOverhang(isPartialMask(params.cellMask) ? undefined : params.overhang).taper;
  const flat = (z: number, inset: number): WallClearanceSection => ({
    z,
    left: inset,
    right: inset,
    front: inset,
    back: inset,
  });
  const lip = lipLevels(params, frame);
  // On a short bin the lip's support reaches down past the floor, so the
  // clearance starts at whatever inset the support has where the floor is.
  const start = lip.length > 0 && zBottom > lip[0].z ? insetAt(lip, zBottom) : COPLANAR_OVERLAP;
  const levels: Level[] = [
    { z: zBottom, inset: start },
    ...lip.filter((l) => l.z > zBottom + COPLANAR_OVERLAP),
  ];
  levels.push({ z: zTop, inset: levels[levels.length - 1].inset });
  if (!taper) return levels.map(({ z, inset }) => flat(z, inset));

  // A taper narrows the cavity below its band. Hold its full inset up to the
  // band top, which only ever keeps the cut further off the wall.
  const bandTop = taper.bandHeight;
  const withBand =
    bandTop > zBottom && bandTop < zTop && !levels.some((l) => l.z === bandTop)
      ? [...levels, { z: bandTop, inset: insetAt(levels, bandTop) }].sort((a, b) => a.z - b.z)
      : levels;
  return withBand.map(({ z, inset }) =>
    z > bandTop
      ? flat(z, inset)
      : {
          z,
          left: inset + taper.left,
          right: inset + taper.right,
          front: inset + taper.front,
          back: inset + taper.back,
        }
  );
}

/** The steps the clearance takes around the stacking lip, lowest first. */
function lipLevels(params: BinParams, frame: CutoutFrame): Level[] {
  const wallT = params.wallThickness;
  const reach = lipInnerReachMm(params);
  const reachIn = Math.max(0, reach - wallT);
  if (!frame.hasLip || reachIn <= 0) return [];
  // `buildTopShape` seats the lip's base plane on the wall top.
  const lipBase = frame.wallHeight + frame.collarHeight;
  const lipFoot = lipBase - LIP_TAPER_WIDTH;
  if (reach !== LIP_TAPER_WIDTH) {
    // Notches reach further in than the support below them: step clear.
    return [
      { z: lipFoot - 0.02, inset: COPLANAR_OVERLAP },
      { z: lipFoot, inset: reachIn + LIP_FACE_CLEARANCE },
    ];
  }
  // The support climbs at 45 deg, from `LIP_SUPPORT_DROP` in from the outer
  // face at its foot to the full taper width, which `boxTopShape` builds; a
  // thin wall leaves a ledge under the foot.
  const footReach = LIP_SUPPORT_DROP - wallT;
  const full = { z: lipBase - LIP_SUPPORT_DROP, inset: reachIn + LIP_FACE_CLEARANCE };
  return footReach > 0
    ? [
        { z: lipFoot - 0.02, inset: COPLANAR_OVERLAP },
        { z: lipFoot, inset: footReach + LIP_FACE_CLEARANCE },
        full,
      ]
    : [{ z: lipFoot - footReach, inset: LIP_FACE_CLEARANCE }, full];
}

/** The inset at `z`, ruled between the levels either side of it. */
function insetAt(levels: readonly Level[], z: number): number {
  for (let i = 1; i < levels.length; i++) {
    const a = levels[i - 1];
    const b = levels[i];
    if (z <= b.z) return a.inset + ((b.inset - a.inset) * (z - a.z)) / (b.z - a.z);
  }
  return levels[levels.length - 1].inset;
}
