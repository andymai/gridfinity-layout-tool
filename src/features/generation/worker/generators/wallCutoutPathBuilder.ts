/** Solids for the cuts `planDividerPathCuts` plans in the fixed dividers. */

import { box, draw, intersect, rotate, translate, unwrap } from 'brepjs';
import type { DisposalScope, Shape3D, Sketch, ValidSolid } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { buildTiltedWallSegment } from './compartmentDividerSegments';
import { pathWallClearance } from './wallCutoutPathClearance';
import {
  cutoutOvershoot,
  planDividerPathCuts,
  type CutoutFrame,
  type DividerPathCut,
  type WallCutoutTool,
} from './wallCutoutPaths';

/** Builds one outer cutout profile, extruded `depth` across and placed at `position`. */
export type ProfileCutterFactory = (
  tool: WallCutoutTool,
  depth: number,
  position: WallCutoutTool['position']
) => Shape3D;

/** How far a run that ends on a wall is carried past it, for the clearance to trim. */
const PAST_WALL_MM = 6;

/**
 * Every path cut as a solid, registered in `scope`. A run that ends on an
 * outer wall is trimmed to the wall clearance, so the far wall and its lip
 * stay whole; inside the opening the outer cutter takes the rest.
 */
export function buildDividerPathCutsInScope(
  scope: DisposalScope,
  params: BinParams,
  frame: CutoutFrame,
  profileCutter: ProfileCutterFactory
): Shape3D[] {
  const cuts = planDividerPathCuts(params, frame);
  if (cuts.length === 0) return [];
  const zTop = frame.wallHeight + cutoutOvershoot(frame.collarHeight, frame.hasLip) + 1;
  let clearance: Shape3D | null = null;
  const clearanceSolid = (): Shape3D => {
    clearance ??= scope.register(buildWallClearance(params, frame));
    return clearance;
  };
  const clip = (shape: Shape3D, other: Shape3D): Shape3D =>
    scope.register(unwrap(intersect(shape as ValidSolid, other as ValidSolid)));

  const out: Shape3D[] = [];
  for (const cut of cuts) {
    let tool: Shape3D;
    let meetsWall = cut.wallAtMin || cut.wallAtMax;
    switch (cut.kind) {
      case 'lowered':
        tool = localBox(scope, cut, cut.loweredTopZ ?? cut.floorZ, zTop);
        break;
      case 'window': {
        tool = scope.register(windowCutter(cut, profileCutter));
        // Most windows sit inside their run, clear of the floor; only one
        // the run or the floor cuts short needs trimming to them.
        const full = fullReach(cut);
        const pastMin = cut.runMin > full.lo;
        const pastMax = cut.runMax < full.hi;
        const floorBites = cut.floorZ > cut.outer.topZ - cut.outer.cutHeight;
        if (pastMin || pastMax || floorBites) {
          tool = clip(tool, localBox(scope, cut, cut.floorZ, zTop, 1));
        }
        meetsWall = (cut.wallAtMin && pastMin) || (cut.wallAtMax && pastMax);
        break;
      }
      case 'oblique': {
        const prism = scope.register(pathPrism(cut, frame, profileCutter));
        tool = clip(prism, obliqueSlab(scope, cut, frame, zTop));
        meetsWall = true;
        break;
      }
    }
    out.push(meetsWall ? clip(tool, clearanceSolid()) : tool);
  }
  return out;
}

/** The divider-frame box of a cut's run, carried past any wall it meets. */
function localBox(
  scope: DisposalScope,
  cut: DividerPathCut,
  z0: number,
  z1: number,
  widen = 0
): Shape3D {
  const u0 = cut.runMin - (cut.wallAtMin ? PAST_WALL_MM : 0);
  const u1 = cut.runMax + (cut.wallAtMax ? PAST_WALL_MM : 0);
  const v0 = cut.vMin - widen;
  const v1 = cut.vMax + widen;
  const local = scope.register(
    box(u1 - u0, v1 - v0, z1 - z0, { at: [(u0 + u1) / 2, (v0 + v1) / 2, (z0 + z1) / 2] })
  );
  return place(scope, local, cut);
}

function place(scope: DisposalScope, local: Shape3D, cut: DividerPathCut): Shape3D {
  const { rotateZ, x, y } = cut.segment;
  const turned =
    rotateZ === 0 ? local : scope.register(rotate(local, rotateZ, { axis: [0, 0, 1] }));
  return scope.register(translate(turned, [x, y, 0]));
}

/**
 * Where along the run the outer profile could reach, in the divider's `u`,
 * with room for any top round-over the plan clamped.
 */
function fullReach(cut: DividerPathCut): { lo: number; hi: number } {
  const { outer, segment } = cut;
  const centre =
    segment.rotateZ === 0 ? outer.position.x - segment.x : outer.position.y - segment.y;
  const reach = outer.cutWidth / 2 + outer.radii.top + 1;
  return { lo: centre - reach, hi: centre + reach };
}

/**
 * The outer profile, extruded across a divider that crosses its path. The
 * profile stands in the outer wall's plane, which is the divider's own.
 */
function windowCutter(cut: DividerPathCut, profileCutter: ProfileCutterFactory): Shape3D {
  const { outer, segment } = cut;
  const depth = cut.vMax - cut.vMin;
  const vMid = (cut.vMin + cut.vMax) / 2;
  // `v` is +Y across a divider along X, and -X across one along Y.
  const position =
    outer.position.rotateZ === 0
      ? { x: outer.position.x, y: segment.y + vMid, rotateZ: 0 }
      : { x: segment.x - vMid, y: outer.position.y, rotateZ: outer.position.rotateZ };
  return profileCutter(outer, depth, position);
}

/** The outer profile carried across the whole cavity along its wall's normal. */
function pathPrism(
  cut: DividerPathCut,
  frame: CutoutFrame,
  profileCutter: ProfileCutterFactory
): Shape3D {
  const { outer } = cut;
  const acrossFront = outer.position.rotateZ === 0;
  const depth = (acrossFront ? frame.innerD : frame.innerW) + 2 * PAST_WALL_MM;
  const position = acrossFront
    ? { x: outer.position.x, y: 0, rotateZ: 0 }
    : { x: 0, y: outer.position.y, rotateZ: outer.position.rotateZ };
  return profileCutter(outer, depth, position);
}

/**
 * The volume an angled or leaning divider takes, grown by the cut's margin
 * and carried up past the rim, so the path's profile can be cut out of it.
 */
function obliqueSlab(
  scope: DisposalScope,
  cut: DividerPathCut,
  frame: CutoutFrame,
  zTop: number
): Shape3D {
  const seg = cut.segment;
  if (seg.leanDeg === 0) return localBox(scope, cut, cut.floorZ, zTop);
  const rad = (seg.rotateZ * Math.PI) / 180;
  const dir = [Math.cos(rad), Math.sin(rad)] as const;
  const height = frame.dividerTopZ;
  // The leaning plane runs from the top line down to the foot; extending it
  // above the top keeps the same plane, so the drift grows in proportion.
  const scale = zTop / height;
  const driftX = (seg.footX - seg.x) * scale;
  const driftY = (seg.footY - seg.y) * scale;
  const lift = scale - 1;
  const topX = seg.x - (seg.footX - seg.x) * lift;
  const topY = seg.y - (seg.footY - seg.y) * lift;
  const u0 = cut.runMin - (cut.wallAtMin ? PAST_WALL_MM : 0);
  const u1 = cut.runMax + (cut.wallAtMax ? PAST_WALL_MM : 0);
  const slab = buildTiltedWallSegment(scope, {
    startX: topX + dir[0] * u0,
    startY: topY + dir[1] * u0,
    endX: topX + dir[0] * u1,
    endY: topY + dir[1] * u1,
    driftX,
    driftY,
    thickness: cut.vMax - cut.vMin,
    height: zTop,
    binInnerW: frame.innerW + 4 * PAST_WALL_MM,
    binInnerD: frame.innerD + 4 * PAST_WALL_MM,
  });
  if (!slab) return localBox(scope, cut, cut.floorZ, zTop);
  return slab;
}

/**
 * The cavity a path may cut in: a hair inside every wall face, clear of the
 * stacking lip's jut, and above the floor. Lofted through rectangles, so
 * each wall is held off by its own clearance at every level.
 */
export function buildWallClearance(params: BinParams, frame: CutoutFrame): Shape3D {
  const { innerW, innerD } = frame;
  const sections = pathWallClearance(params, frame);
  const sketches = sections.map(
    (s) =>
      draw([-innerW / 2 + s.left, -innerD / 2 + s.front])
        .lineTo([innerW / 2 - s.right, -innerD / 2 + s.front])
        .lineTo([innerW / 2 - s.right, innerD / 2 - s.back])
        .lineTo([-innerW / 2 + s.left, innerD / 2 - s.back])
        .close()
        .sketchOnPlane('XY', s.z) as Sketch
  );
  const [first, ...rest] = sketches;
  return first.loftWith(rest, { ruled: true });
}
