/**
 * Where each outer wall cutout carries on across the bin.
 *
 * With `walls.interior` on and an outer side cut, the opening runs straight
 * across the bin along the wall's normal, and every fixed divider in its way
 * drops to the same profile: the reporter's "anything in the path of a cutout
 * is low". Only the dividers are cut, so the far wall, its stacking lip, the
 * floor and the features standing apart from the dividers keep their shape.
 *
 * Pure: the builder, the scoop's doorway test and the divider pattern's
 * keep-outs all read the same plan.
 */

import type { BinParams } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import { resolveBinFloorMm, resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';
import { labelTabFootprints } from '@/shared/utils/labelTabPlan';
import {
  computeCutoutCenter,
  cornerSlackFor,
  cutoutFloorRise,
  cutoutOpens,
  wallCutoutPathsActive,
  resolveCutoutCornerRadii,
  resolveCutoutDrop,
  resolveCutoutSpan,
  safeCutoutCornerRadii,
  type CornerSlack,
  type CutoutCornerRadii,
} from '@/shared/utils/wallCutoutPosition';
import {
  COPLANAR_OVERLAP,
  CUT_RIM_CLEARANCE,
  LIP_HEIGHT,
  LIP_SMALL_TAPER,
} from './generatorConstants';
import { interiorDividerSegments, type InteriorDividerSegment } from './compartmentDividerSegments';
import {
  cellsAlong,
  cutReachInto,
  runStretches,
  type CutSizing,
  type RunStretch,
} from './wallCutoutPathStretches';
import { resolveFloorRaises } from './floorRaisePlan';
import { resolvePolygonSideGeometry, type PolygonSideGeometry } from './maskPolygonEdges';
import { pitchFromParams } from './gridPitch';
import type { BinDimensions } from './pipeline/types';

export { wallCutoutPathsActive };

export type OuterSide = 'front' | 'back' | 'left' | 'right';

const OUTER_SIDES: readonly OuterSide[] = ['front', 'back', 'left', 'right'];

/** One cutter, resolved but not built. */
export interface WallCutoutTool {
  readonly cutWidth: number;
  /** Depth of the cut below `topZ`. */
  readonly cutHeight: number;
  readonly overshoot: number;
  /** Top of the material the cut drops from. */
  readonly topZ: number;
  readonly position: { readonly x: number; readonly y: number; readonly rotateZ: number };
  readonly cornerSlack: CornerSlack;
  readonly radii: CutoutCornerRadii;
  /** The part of `overshoot` that is collar. */
  readonly collarHeight: number;
}

/** An outer wall's cutter, with the wall it belongs to. */
export interface OuterCutoutTool extends WallCutoutTool {
  readonly side: OuterSide;
}

/** The body the cutters work on: the cavity and the wall they drop from. */
export interface CutoutFrame {
  readonly innerW: number;
  readonly innerD: number;
  readonly wallHeight: number;
  readonly collarHeight: number;
  readonly hasLip: boolean;
  /** Where the fixed dividers end, in the body frame. */
  readonly dividerTopZ: number;
  /** Extra reach either side of what a cut trims, for clearing what stands against it. */
  readonly depthPadding: number;
}

/**
 * Where the interior dividers actually end, in the body frame.
 *
 * The two divider paths do not agree: the multi-cavity cut leaves pockets that
 * reach the rim, so those dividers stand to the wall top, while divider-wall
 * boxes stop at the interior height, a lip taper short of it, or lower still
 * when a design shortens them.
 */
export function interiorDividerTopZ(
  params: BinParams,
  dim: Pick<BinDimensions, 'compartmentsBakedIntoShell' | 'wallHeight' | 'interiorHeight'>
): number {
  return dim.compartmentsBakedIntoShell
    ? dim.wallHeight
    : resolveCompartmentDividerHeight(params.compartments.dividerHeight, dim.interiorHeight);
}

/** The frame a bin's cutters work in. */
export function cutoutFrame(params: BinParams, dim: BinDimensions, depthPadding = 0): CutoutFrame {
  return {
    innerW: dim.innerW,
    innerD: dim.innerD,
    wallHeight: dim.wallHeight,
    collarHeight: dim.collarHeight,
    hasLip: dim.hasLip,
    dividerTopZ: interiorDividerTopZ(params, dim),
    depthPadding,
  };
}

/** Room the cut runs up through above the nominal wall top: collar and lip. */
export function cutoutOvershoot(collarHeight: number, hasLip: boolean): number {
  return collarHeight + (hasLip ? LIP_HEIGHT : 0) + CUT_RIM_CLEARANCE;
}

/**
 * Every outer wall cutter, in the order the builder makes them.
 *
 * For non-rectangular bins each side maps to the outermost polygon edge
 * facing that way, and a side with no such edge is skipped.
 */
export function planOuterCutoutTools(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  collarHeight: number,
  hasLip: boolean
): OuterCutoutTool[] {
  const wallThickness = params.wallThickness;
  const tools: OuterCutoutTool[] = [];
  // The drop stays measured from the nominal wall top, but the cut has to
  // run on up through the collar to the real rim, or the collar bridges it.
  const overshoot = cutoutOvershoot(collarHeight, hasLip);
  const cellMask = params.cellMask;
  const sides: PolygonSideGeometry[] = isPartialMask(cellMask)
    ? OUTER_SIDES.map((key) =>
        resolvePolygonSideGeometry(cellMask, pitchFromParams(params), wallThickness, key)
      ).filter((g): g is PolygonSideGeometry => g !== null)
    : [
        { key: 'front', wallSpan: innerW, x: 0, y: -innerD / 2, rotateZ: 0 },
        { key: 'back', wallSpan: innerW, x: 0, y: innerD / 2, rotateZ: 0 },
        { key: 'left', wallSpan: innerD, x: -innerW / 2, y: 0, rotateZ: 90 },
        { key: 'right', wallSpan: innerD, x: innerW / 2, y: 0, rotateZ: 90 },
      ];

  for (const side of sides) {
    const cfg = params.walls[side.key];
    if (!cfg.enabled || !cutoutOpens(cfg, side.wallSpan, wallHeight - wallThickness)) continue;

    const cutWidth = resolveCutoutSpan(cfg, side.wallSpan);
    const userCutHeight = resolveCutoutDrop(cfg, wallHeight - wallThickness);

    const centerOffset = computeCutoutCenter(
      side.wallSpan,
      cutWidth,
      wallThickness,
      cfg.alignment,
      cfg.offset
    );

    tools.push({
      side: side.key,
      cutWidth,
      cutHeight: userCutHeight,
      overshoot,
      topZ: wallHeight,
      position: {
        x: side.rotateZ === 0 ? side.x + centerOffset : side.x,
        y: side.rotateZ !== 0 ? side.y + centerOffset : side.y,
        rotateZ: side.rotateZ,
      },
      cornerSlack: cornerSlackFor(side.wallSpan, cutWidth, centerOffset),
      radii: resolveCutoutCornerRadii(params.walls, cfg, cutWidth),
      collarHeight,
    });
  }
  return tools;
}

/**
 * How a path meets one divider.
 *
 * - `window`: the divider crosses the path, so it takes the opening's profile.
 * - `lowered`: the divider runs along the path, so it drops along its whole
 *   run to the profile's floor where it stands, flat across its thickness.
 * - `oblique`: an angled or leaning divider, cut where the path's profile
 *   passes through it.
 */
export type DividerPathCutKind = 'window' | 'lowered' | 'oblique';

/** One divider's share of one path, in the divider's own frame. */
export interface DividerPathCut {
  readonly kind: DividerPathCutKind;
  readonly outer: OuterCutoutTool;
  readonly segment: InteriorDividerSegment;
  /**
   * Along the divider (`u`, from its midpoint toward `rotateZ`) and across it
   * (`v`, 90 degrees anticlockwise of `u`): the box the cut stays inside.
   * A run that ends on an outer wall stops at that wall's face.
   */
  readonly uMin: number;
  readonly uMax: number;
  readonly vMin: number;
  readonly vMax: number;
  /**
   * The stretch of the run the cut may reach along, in `u`: out to a wall's
   * face, across the divider met at a junction, or to where the floor beside
   * the run steps.
   */
  readonly runMin: number;
  readonly runMax: number;
  /** Which ends of the run sit on an outer wall. */
  readonly wallAtMin: boolean;
  readonly wallAtMax: boolean;
  /** The floor under the divider, or the raised floor beside it: never cut below. */
  readonly floorZ: number;
  /** The divider's new top, for a `lowered` cut. */
  readonly loweredTopZ: number | null;
  /** The lowest the cut reaches. */
  readonly zMin: number;
}

/** A lowered top within this of the opening's floor is taken down onto it. */
const FLOOR_SNAP_MM = 0.05;

/** A cut shallower than this leaves the divider standing as it was. */
const MIN_LOWERING_MM = 0.5;

/** Distance under which an end point counts as lying on a wall face. */
const WALL_END_TOL = 1e-3;

const DEG = Math.PI / 180;

/** The profile's lowest Z and how far its opening reaches along the wall. */
interface PathProfile {
  readonly outer: OuterCutoutTool;
  /** Wall-span axis: x for front/back, y for left/right. */
  readonly spanAxis: 'x' | 'y';
  /** Centre of the opening along the span axis. */
  readonly centre: number;
  /** Half the opening's widest reach, its top round-over included. */
  readonly halfReach: number;
  readonly floorZ: number;
  /** Height of the bottom edge above `floorZ` at an offset from `centre`. */
  readonly riseAt: (offset: number) => number;
}

function pathProfile(params: BinParams, outer: OuterCutoutTool): PathProfile {
  const lipRoom = outer.overshoot - CUT_RIM_CLEARANCE;
  const safe = safeCutoutCornerRadii(
    outer.radii,
    outer.cutWidth,
    outer.cutHeight,
    lipRoom,
    outer.cornerSlack
  );
  const spanAxis = outer.position.rotateZ === 0 ? 'x' : 'y';
  const floor = {
    shape: params.walls.shape,
    cutWidth: outer.cutWidth,
    drop: outer.cutHeight,
    lipRoom,
    collarHeight: outer.collarHeight,
    rimClearance: CUT_RIM_CLEARANCE,
    safe,
  };
  // The profile is sketched on XZ and turned +90 deg for the side walls, so
  // its x is world +X on front and back and world +Y on left and right: the
  // same direction `cornerSlackFor` measures its left and right slack in.
  return {
    outer,
    spanAxis,
    centre: spanAxis === 'x' ? outer.position.x : outer.position.y,
    halfReach: outer.cutWidth / 2 + Math.max(safe.topLeft, safe.topRight),
    floorZ: outer.topZ - outer.cutHeight,
    riseAt: (offset) => cutoutFloorRise(floor, offset),
  };
}

/** Lowest rise of the profile over `[lo, hi]`, offsets from its centre. */
function lowestRise(profile: PathProfile, lo: number, hi: number): number {
  if (lo <= 0 && hi >= 0) return profile.riseAt(0);
  // The floor only climbs away from the centre, so the nearer end is lowest.
  return Math.abs(lo) < Math.abs(hi) ? profile.riseAt(lo) : profile.riseAt(hi);
}

function onWall(x: number, y: number, innerW: number, innerD: number): boolean {
  return (
    Math.abs(Math.abs(x) - innerW / 2) < WALL_END_TOL ||
    Math.abs(Math.abs(y) - innerD / 2) < WALL_END_TOL
  );
}

/** Mirror of the compartment builder's guard: too-small cells get no dividers. */
function dividersAreBuilt(params: BinParams, innerW: number, innerD: number): boolean {
  const { cols, rows, thickness } = params.compartments;
  if (cols <= 1 && rows <= 1) return false;
  const effW = (innerW - (cols - 1) * thickness) / cols;
  const effD = (innerD - (rows - 1) * thickness) / rows;
  return effW >= thickness * 2 && effD >= thickness * 2;
}

/**
 * The cuts each path makes in the fixed dividers, or nothing when the paths
 * are off. `depthPadding` widens every cut across its divider.
 */
export function planDividerPathCuts(params: BinParams, frame: CutoutFrame): DividerPathCut[] {
  if (!wallCutoutPathsActive(params, frame)) return [];
  const { innerW, innerD, dividerTopZ } = frame;
  if (!dividersAreBuilt(params, innerW, innerD)) return [];

  const outers = planOuterCutoutTools(
    params,
    innerW,
    innerD,
    frame.wallHeight,
    frame.collarHeight,
    frame.hasLip
  );
  if (outers.length === 0) return [];

  const thickness = params.compartments.thickness;
  const binFloorZ = resolveBinFloorMm(params);
  // Mirrors `deriveDimensions`: the interior stops the lip's small taper short.
  const interiorHeight = frame.hasLip ? frame.wallHeight - LIP_SMALL_TAPER : frame.wallHeight;
  const sizing: CutSizing = {
    params,
    innerW,
    innerD,
    thickness,
    binFloorZ,
    raises: resolveFloorRaises(params, binFloorZ, interiorHeight),
    tabs: labelTabFootprints(params, innerW, innerD, interiorHeight, params.wallThickness),
    tabInset: params.label.inset ?? 0,
    reachInto: cutReachInto(params, frame),
  };
  const profiles = outers.map((o) => pathProfile(params, o));

  const out: DividerPathCut[] = [];
  for (const seg of interiorDividerSegments(params, innerW, innerD, dividerTopZ)) {
    const rad = seg.rotateZ * DEG;
    const dir = { x: Math.cos(rad), y: Math.sin(rad) };
    const half = seg.wallLen / 2;
    const endMin = { x: seg.x - dir.x * half, y: seg.y - dir.y * half };
    const endMax = { x: seg.x + dir.x * half, y: seg.y + dir.y * half };
    const wallAtMin = onWall(endMin.x, endMin.y, innerW, innerD);
    const wallAtMax = onWall(endMax.x, endMax.y, innerW, innerD);
    const straightX = Math.abs(dir.y) < 1e-9;
    const straightY = Math.abs(dir.x) < 1e-9;
    const straight = (straightX || straightY) && seg.leanDeg === 0;

    if (!straight) {
      out.push(...obliqueCuts(sizing, seg, dir, wallAtMin, wallAtMax, profiles, dividerTopZ));
      continue;
    }

    // `u` runs along X for a divider at 0 deg and along Y at 90 deg.
    const runsAlongX = straightX;
    const stretches = runStretches(sizing, seg, runsAlongX, dir, wallAtMin, wallAtMax);
    const along = runsAlongX ? seg.x : seg.y;
    const acrossCentre = runsAlongX ? seg.y : seg.x;

    for (const profile of profiles) {
      const crossesPath = runsAlongX === (profile.spanAxis === 'x');
      if (crossesPath) {
        for (const stretch of stretches) {
          const lo = Math.max(stretch.uMin, profile.centre - profile.halfReach - along);
          const hi = Math.min(stretch.uMax, profile.centre + profile.halfReach - along);
          if (hi - lo < 0.1) continue;
          const zMin = Math.max(profile.floorZ, stretch.floorZ);
          if (zMin >= dividerTopZ - MIN_LOWERING_MM) continue;
          out.push(
            stretchCut(profile.outer, seg, stretch, 'window', {
              uMin: lo,
              uMax: hi,
              zMin,
              top: null,
            })
          );
        }
        continue;
      }

      const offset = acrossCentre - profile.centre;
      const rawRise = lowestRise(profile, offset - thickness / 2, offset + thickness / 2);
      if (!Number.isFinite(rawRise)) continue;
      // A divider just inside a bottom fillet sits microns above the floor.
      // Taken down to it, it meets the dividers crossing it level instead of
      // leaving a step too small to print and plain to see in the preview.
      const rise = rawRise < FLOOR_SNAP_MM ? 0 : rawRise;
      for (const stretch of stretches) {
        const top = Math.max(profile.floorZ + rise, stretch.floorZ);
        if (top >= dividerTopZ - MIN_LOWERING_MM) continue;
        out.push(
          stretchCut(profile.outer, seg, stretch, 'lowered', {
            uMin: stretch.uMin,
            uMax: stretch.uMax,
            zMin: top,
            top,
          })
        );
      }
    }
  }
  return withoutRepeats(out);
}

function stretchCut(
  outer: OuterCutoutTool,
  segment: InteriorDividerSegment,
  stretch: RunStretch,
  kind: 'window' | 'lowered',
  at: { uMin: number; uMax: number; zMin: number; top: number | null }
): DividerPathCut {
  return {
    kind,
    outer,
    segment,
    uMin: at.uMin,
    uMax: at.uMax,
    vMin: stretch.vMin,
    vMax: stretch.vMax,
    runMin: stretch.uMin,
    runMax: stretch.uMax,
    wallAtMin: stretch.wallAtMin,
    wallAtMax: stretch.wallAtMax,
    floorZ: stretch.floorZ,
    loweredTopZ: at.top,
    zMin: at.zMin,
  };
}

/** Cuts in an angled or leaning divider, where each path's profile passes through it. */
function obliqueCuts(
  sizing: CutSizing,
  seg: InteriorDividerSegment,
  dir: { readonly x: number; readonly y: number },
  wallAtMin: boolean,
  wallAtMax: boolean,
  profiles: readonly PathProfile[],
  dividerTopZ: number
): DividerPathCut[] {
  const ids = cellsAlong(sizing.params, seg, sizing.innerW, sizing.innerD).flatMap((c) => [
    c.below,
    c.above,
  ]);
  const reach =
    ids.length > 0 ? Math.min(...ids.map(sizing.reachInto)) : sizing.reachInto(undefined);
  const halfV = sizing.thickness / 2 + reach;
  // A junction end reaches across the divider it meets. That divider is
  // square to the run's grid line, so an angled run needs further to clear it.
  const square = Math.max(
    0.3,
    Math.abs(dir.y) >= Math.abs(dir.x) ? Math.abs(dir.y) : Math.abs(dir.x)
  );
  const half = seg.wallLen / 2;
  const runMin = -half - (wallAtMin ? 0 : halfV / square);
  const runMax = half + (wallAtMax ? 0 : halfV / square);
  const floorZ = sizing.binFloorZ + COPLANAR_OVERLAP;
  const out: DividerPathCut[] = [];
  for (const profile of profiles) {
    const hit = obliqueSpan(profile, seg, dir, runMin, runMax);
    if (!hit || profile.floorZ >= dividerTopZ - MIN_LOWERING_MM) continue;
    out.push({
      kind: 'oblique',
      outer: profile.outer,
      segment: seg,
      uMin: hit.uMin,
      uMax: hit.uMax,
      vMin: -halfV,
      vMax: halfV,
      runMin,
      runMax,
      wallAtMin,
      wallAtMax,
      floorZ,
      loweredTopZ: null,
      zMin: Math.max(profile.floorZ, floorZ),
    });
  }
  return out;
}

/**
 * Drop cuts another one already holds: opposite walls cut alike lay the same
 * window twice, and the lower of two drops along a stretch covers the higher.
 * Two coincident solids are the worst case for the fuse that joins them.
 */
function withoutRepeats(cuts: readonly DividerPathCut[]): DividerPathCut[] {
  const lowest = new Map<InteriorDividerSegment, Map<number, DividerPathCut>>();
  const windows = new Set<string>();
  const out: DividerPathCut[] = [];
  for (const cut of cuts) {
    if (cut.kind === 'lowered') {
      let stretches = lowest.get(cut.segment);
      if (!stretches) {
        stretches = new Map();
        lowest.set(cut.segment, stretches);
      }
      const held = stretches.get(cut.runMin);
      if (!held || (cut.loweredTopZ ?? 0) < (held.loweredTopZ ?? 0)) {
        stretches.set(cut.runMin, cut);
      }
      continue;
    }
    if (cut.kind === 'window') {
      const { outer } = cut;
      const along = outer.position.rotateZ === 0 ? outer.position.x : outer.position.y;
      const key = JSON.stringify([
        cut.segment.x,
        cut.segment.y,
        cut.runMin,
        cut.runMax,
        along,
        outer.position.rotateZ,
        outer.cutWidth,
        outer.cutHeight,
        outer.radii,
        outer.cornerSlack.left,
        outer.cornerSlack.right,
      ]);
      if (windows.has(key)) continue;
      windows.add(key);
    }
    out.push(cut);
  }
  return [...out, ...[...lowest.values()].flatMap((stretches) => [...stretches.values()])];
}

/** The stretch of an angled divider the path's band crosses, in its `u`. */
function obliqueSpan(
  profile: PathProfile,
  seg: InteriorDividerSegment,
  dir: { x: number; y: number },
  uMin: number,
  uMax: number
): { uMin: number; uMax: number } | null {
  const lo = profile.centre - profile.halfReach;
  const hi = profile.centre + profile.halfReach;
  const mid = profile.spanAxis === 'x' ? seg.x : seg.y;
  const slope = profile.spanAxis === 'x' ? dir.x : dir.y;
  // A leaning wall's foot drifts off its top line, so the band is widened by
  // that drift before it is mapped onto the run.
  const drift = Math.abs(profile.spanAxis === 'x' ? seg.footX - seg.x : seg.footY - seg.y);
  if (Math.abs(slope) < 1e-9) {
    return mid >= lo - drift && mid <= hi + drift ? { uMin, uMax } : null;
  }
  const a = (lo - drift - mid) / slope;
  const b = (hi + drift - mid) / slope;
  const from = Math.max(uMin, Math.min(a, b));
  const to = Math.min(uMax, Math.max(a, b));
  return to - from >= 0.1 ? { uMin: from, uMax: to } : null;
}
