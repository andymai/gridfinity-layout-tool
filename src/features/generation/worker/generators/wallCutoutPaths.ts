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
import { lipInnerReachMm } from '@/shared/utils/lipNotchPlan';
import { interiorFilletCornerMm } from '@/shared/utils/interiorFillet';
import { resolveBinFloorMm, resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';
import { labelTabFootprints } from '@/shared/utils/labelTabPlan';
import { resolveOverhang } from '@/shared/utils/overhang';
import {
  computeCutoutCenter,
  cornerSlackFor,
  cutoutFloorRise,
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
  LIP_SUPPORT_DROP,
  LIP_TAPER_WIDTH,
} from './generatorConstants';
import { interiorDividerSegments, type InteriorDividerSegment } from './compartmentDividerSegments';
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
    if (!cfg.enabled) continue;

    const cutWidth = resolveCutoutSpan(cfg, side.wallSpan);
    const userCutHeight = resolveCutoutDrop(cfg, wallHeight - wallThickness);
    if (cutWidth < 0.1 || userCutHeight < 0.1) continue;

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
   * The run the cut may reach along, in `u`: out to a wall's face, or across
   * the divider met at a junction.
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

/**
 * Margin either side of a divider's faces, so a cut box never shares a plane
 * with them. Small, because whatever is fused to the face loses this much.
 */
const DIVIDER_FACE_CLEARANCE = 0.2;

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

/** Compartment ids on either side of a straight divider run. */
function compartmentsBeside(
  params: BinParams,
  seg: InteriorDividerSegment,
  innerW: number,
  innerD: number
): number[] {
  const { cols, rows, cells } = params.compartments;
  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const ids: number[] = [];
  const along = Math.abs(Math.sin(seg.rotateZ * DEG)) > 0.5 ? 'y' : 'x';
  if (along === 'y') {
    const boundary = Math.round((seg.x + innerW / 2) / cellW);
    const r0 = Math.round((seg.y - seg.segLen / 2 + innerD / 2) / cellD);
    const r1 = Math.round((seg.y + seg.segLen / 2 + innerD / 2) / cellD);
    for (let row = Math.max(0, r0); row < Math.min(rows, r1); row++) {
      if (boundary > 0) ids.push(cells[row * cols + boundary - 1]);
      if (boundary < cols) ids.push(cells[row * cols + boundary]);
    }
  } else {
    const boundary = Math.round((seg.y + innerD / 2) / cellD);
    const c0 = Math.round((seg.x - seg.segLen / 2 + innerW / 2) / cellW);
    const c1 = Math.round((seg.x + seg.segLen / 2 + innerW / 2) / cellW);
    for (let col = Math.max(0, c0); col < Math.min(cols, c1); col++) {
      if (boundary > 0) ids.push(cells[(boundary - 1) * cols + col]);
      if (boundary < rows) ids.push(cells[boundary * cols + col]);
    }
  }
  return ids;
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
  if (!wallCutoutPathsActive(params)) return [];
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
  const margin = DIVIDER_FACE_CLEARANCE + interiorFilletCornerMm(params) + frame.depthPadding;
  const halfV = thickness / 2 + margin;
  const binFloorZ = resolveBinFloorMm(params);
  // Mirrors `deriveDimensions`: the interior stops the lip's small taper short.
  const interiorHeight = frame.hasLip ? frame.wallHeight - LIP_SMALL_TAPER : frame.wallHeight;
  const raises = resolveFloorRaises(params, binFloorZ, interiorHeight);
  const tabs = labelTabFootprints(params, innerW, innerD, interiorHeight, params.wallThickness);
  const tabInset = params.label.inset ?? 0;
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
    // A junction end reaches across the divider it meets. That divider is
    // square to the run's grid line, so an angled run needs further to
    // clear it.
    const square = Math.max(
      0.3,
      Math.abs(dir.y) >= Math.abs(dir.x) ? Math.abs(dir.y) : Math.abs(dir.x)
    );
    const junctionReach = halfV / square;
    const uMin = -half - (wallAtMin ? 0 : junctionReach);
    const uMax = half + (wallAtMax ? 0 : junctionReach);
    const straightX = Math.abs(dir.y) < 1e-9;
    const straightY = Math.abs(dir.x) < 1e-9;
    const straight = (straightX || straightY) && seg.leanDeg === 0;

    let floorZ = binFloorZ;
    if (straight) {
      for (const id of compartmentsBeside(params, seg, innerW, innerD)) {
        floorZ = Math.max(floorZ, binFloorZ + (raises.get(id) ?? 0));
      }
    }
    floorZ += COPLANAR_OVERLAP;

    for (const profile of profiles) {
      const base = {
        outer: profile.outer,
        segment: seg,
        runMin: uMin,
        runMax: uMax,
        wallAtMin,
        wallAtMax,
        floorZ,
      };
      if (!straight) {
        const hit = obliqueSpan(profile, seg, dir, uMin, uMax);
        if (!hit || profile.floorZ >= dividerTopZ - MIN_LOWERING_MM) continue;
        out.push({
          ...base,
          kind: 'oblique',
          uMin: hit.uMin,
          uMax: hit.uMax,
          vMin: -halfV,
          vMax: halfV,
          loweredTopZ: null,
          zMin: Math.max(profile.floorZ, floorZ),
        });
        continue;
      }
      // `u` runs along X for a divider at 0 deg and along Y at 90 deg.
      const runsAlongX = straightX;
      const crossesPath = runsAlongX === (profile.spanAxis === 'x');
      const along = runsAlongX ? seg.x : seg.y;
      const acrossCentre = runsAlongX ? seg.y : seg.x;
      // `v` is +Y for a divider along X, and -X for one along Y.
      const vSign = runsAlongX ? 1 : -1;
      const tabReach = tabReachAcross(tabs, seg, runsAlongX, thickness, tabInset, margin);
      const vMin = Math.min(-halfV, vSign > 0 ? tabReach.lo : -tabReach.hi);
      const vMax = Math.max(halfV, vSign > 0 ? tabReach.hi : -tabReach.lo);

      if (crossesPath) {
        const lo = Math.max(uMin, profile.centre - profile.halfReach - along);
        const hi = Math.min(uMax, profile.centre + profile.halfReach - along);
        if (hi - lo < 0.1) continue;
        if (Math.max(profile.floorZ, floorZ) >= dividerTopZ - MIN_LOWERING_MM) continue;
        out.push({
          ...base,
          kind: 'window',
          uMin: lo,
          uMax: hi,
          vMin,
          vMax,
          loweredTopZ: null,
          zMin: Math.max(profile.floorZ, floorZ),
        });
        continue;
      }

      const offset = acrossCentre - profile.centre;
      if (!Number.isFinite(profile.riseAt(offset))) continue;
      const rawRise = lowestRise(profile, offset - thickness / 2, offset + thickness / 2);
      // A divider just inside a bottom fillet sits microns above the floor.
      // Taken down to it, it meets the dividers crossing it level instead of
      // leaving a step too small to print and plain to see in the preview.
      const rise = rawRise < FLOOR_SNAP_MM ? 0 : rawRise;
      const top = Math.max(profile.floorZ + rise, floorZ);
      if (top >= dividerTopZ - MIN_LOWERING_MM) continue;
      out.push({
        ...base,
        kind: 'lowered',
        uMin,
        uMax,
        vMin,
        vMax,
        loweredTopZ: top,
        zMin: top,
      });
    }
  }
  return withoutRepeats(out);
}

/**
 * Drop cuts another one already holds: opposite walls cut alike lay the same
 * window twice, and the lower of two drops along a run covers the higher.
 * Two coincident solids are the worst case for the fuse that joins them.
 */
function withoutRepeats(cuts: readonly DividerPathCut[]): DividerPathCut[] {
  const lowest = new Map<InteriorDividerSegment, DividerPathCut>();
  const windows = new Set<string>();
  const out: DividerPathCut[] = [];
  for (const cut of cuts) {
    if (cut.kind === 'lowered') {
      const held = lowest.get(cut.segment);
      if (!held || (cut.loweredTopZ ?? 0) < (held.loweredTopZ ?? 0)) lowest.set(cut.segment, cut);
      continue;
    }
    if (cut.kind === 'window') {
      const { outer } = cut;
      const along = outer.position.rotateZ === 0 ? outer.position.x : outer.position.y;
      const key = JSON.stringify([
        cut.segment.x,
        cut.segment.y,
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
  return [...out, ...lowest.values()];
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

/**
 * How far either side of a straight divider its label tabs reach, in world
 * terms across the run (`lo` toward -Y or -X), with `margin` beyond the tab.
 * A tab hangs from the divider's top, so a cut that takes the divider must
 * take the tab with it or leave the tab floating.
 */
function tabReachAcross(
  tabs: ReturnType<typeof labelTabFootprints>,
  seg: InteriorDividerSegment,
  runsAlongX: boolean,
  thickness: number,
  inset: number,
  margin: number
): { lo: number; hi: number } {
  let lo = 0;
  let hi = 0;
  // Tabs hang from row boundaries only, so a divider along Y carries none.
  if (!runsAlongX) return { lo, hi };
  const reach = thickness / 2 + inset + 0.5;
  const x0 = seg.x - seg.segLen / 2;
  const x1 = seg.x + seg.segLen / 2;
  for (const tab of tabs) {
    if (tab.xMax <= x0 || tab.xMin >= x1) continue;
    if (Math.abs(tab.yMax - seg.y) <= reach && tab.yMin < seg.y) {
      lo = Math.min(lo, tab.yMin - seg.y - margin);
    } else if (Math.abs(tab.yMin - seg.y) <= reach && tab.yMax > seg.y) {
      hi = Math.max(hi, tab.yMax - seg.y + margin);
    }
  }
  return { lo, hi };
}

/** One level of the clearance a path keeps from the outer walls, in mm in from each inner face. */
export interface WallClearanceSection {
  readonly z: number;
  readonly left: number;
  readonly right: number;
  readonly front: number;
  readonly back: number;
}

/**
 * How far a path has to stay off each outer wall, level by level, from below
 * the floor to above the rim: a hair off the wall's face, and clear of the
 * stacking lip's inward jut where the lip stands. Ruled between levels.
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
  const levels: Array<{ z: number; inset: number }> = [{ z: zBottom, inset: COPLANAR_OVERLAP }];
  const wallT = params.wallThickness;
  const reach = lipInnerReachMm(params);
  const reachIn = Math.max(0, reach - wallT);
  if (frame.hasLip && reachIn > 0) {
    // `buildTopShape` seats the lip's base plane on the wall top.
    const lipBase = frame.wallHeight + frame.collarHeight;
    const lipFoot = lipBase - LIP_TAPER_WIDTH;
    if (reach !== LIP_TAPER_WIDTH) {
      // Notches reach further in than the support below them: step clear.
      levels.push({ z: lipFoot - 0.02, inset: COPLANAR_OVERLAP });
      levels.push({ z: lipFoot, inset: reachIn + LIP_FACE_CLEARANCE });
    } else {
      // The support climbs at 45 deg, from `LIP_SUPPORT_DROP` in from the
      // outer face at its foot to the full taper width, which `boxTopShape`
      // builds; a thin wall leaves a ledge under the foot.
      const footReach = LIP_SUPPORT_DROP - wallT;
      if (footReach > 0) {
        levels.push({ z: lipFoot - 0.02, inset: COPLANAR_OVERLAP });
        levels.push({ z: lipFoot, inset: footReach + LIP_FACE_CLEARANCE });
      } else {
        levels.push({ z: lipFoot - footReach, inset: LIP_FACE_CLEARANCE });
      }
      levels.push({ z: lipBase - LIP_SUPPORT_DROP, inset: reachIn + LIP_FACE_CLEARANCE });
    }
  }
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

function insetAt(levels: ReadonlyArray<{ z: number; inset: number }>, z: number): number {
  for (let i = 1; i < levels.length; i++) {
    const a = levels[i - 1];
    const b = levels[i];
    if (z <= b.z) return a.inset + ((b.inset - a.inset) * (z - a.z)) / (b.z - a.z);
  }
  return levels[levels.length - 1].inset;
}

/** Room left between a path and the lip's own faces: more than a coplanar overlap. */
const LIP_FACE_CLEARANCE = 0.02;
