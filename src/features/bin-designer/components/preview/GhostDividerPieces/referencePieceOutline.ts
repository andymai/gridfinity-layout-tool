import polygonClipping, { type Pair, type Ring } from 'polygon-clipping';
import * as THREE from 'three';
import type { WallCutoutShape } from '@/shared/types/bin';
import type { PieceWindow } from '@/shared/utils/dividerPieceWindow';
import {
  cutoutSide,
  safeCutoutCornerRadii,
  shoulderBlend,
  type ShoulderBlend,
} from '@/shared/utils/wallCutoutPosition';
import { CUT_RIM_CLEARANCE } from '@/shared/generation/generatorConstants';

const ARC_STEPS = 8;
/** How far a cut ring reaches past the edge it opens, so the difference is clean. */
const PAST_EDGE = 1;

/** A cross-lap notch, `depth` in from the top or bottom edge. */
export interface ReferenceNotch {
  readonly offset: number;
  readonly width: number;
  readonly depth: number;
  readonly fromTop: boolean;
}

function arc(centre: readonly [number, number], radius: number, from: number, to: number): Pair[] {
  const out: Pair[] = [];
  for (let i = 0; i <= ARC_STEPS; i++) {
    const a = from + ((to - from) * i) / ARC_STEPS;
    out.push([centre[0] + radius * Math.cos(a), centre[1] + radius * Math.sin(a)]);
  }
  return out;
}

/** The round-over from the rim down onto the side, for the right-hand end. */
function flare(blend: ShoulderBlend | null): Pair[] {
  if (!blend) return [];
  const [cx, cy] = blend.centre;
  const to = Math.atan2(blend.side[1] - cy, blend.side[0] - cx);
  return arc(blend.centre, blend.radius, Math.PI / 2, to);
}

/**
 * The right half of a u-shape or funnel window, from the rim down to the
 * centre line of its floor, in the window's own frame with the rim at `top`.
 */
function rightHalf(
  shape: 'u-shape' | 'funnel',
  window: PieceWindow,
  top: number,
  safe: ReturnType<typeof safeCutoutCornerRadii>
): Pair[] {
  const bottom = top - window.depth;
  const side = cutoutSide(shape, window.width, window.depth, CUT_RIM_CLEARANCE);
  const blend =
    safe.topRight > 0 ? shoulderBlend(side.halfWidthAtRim, top, side.lean, safe.topRight) : null;
  const startX = blend ? blend.rim[0] : side.halfWidthAtRim;
  const points: Pair[] = [[startX, top + PAST_EDGE], ...flare(blend)];
  if (!blend) points.push([startX, top]);
  // The funnel's floor meets its slope at an angle; the solid fillets it, the
  // outline does not.
  const r = shape === 'u-shape' ? safe.bottomRight : 0;
  if (r > 0) {
    points.push(...arc([side.bottomHalfWidth - r, bottom + r], r, 0, -Math.PI / 2));
  } else {
    points.push([side.bottomHalfWidth, bottom]);
  }
  points.push([0, bottom]);
  return points;
}

/** The window's outline, open past the piece's top edge at `top`. */
export function windowOutline(shape: WallCutoutShape, window: PieceWindow, top: number): Ring {
  const hw = window.width / 2;
  let ring: Pair[];
  if (shape === 'scoop') {
    const sagitta = Math.min(hw, window.depth);
    const r = sagitta / 2 + (window.width * window.width) / (8 * sagitta);
    const half = Math.asin(Math.min(1, hw / r));
    ring = [
      [hw, top + PAST_EDGE],
      ...arc([0, top - sagitta + r], r, -Math.PI / 2 + half, -Math.PI / 2 - half),
      [-hw, top + PAST_EDGE],
    ];
  } else {
    const safe = safeCutoutCornerRadii(
      window.radii,
      window.width,
      window.depth,
      0,
      window.cornerSlack
    );
    const right = rightHalf(shape, window, top, safe);
    const left = rightHalf(shape, window, top, {
      ...safe,
      topRight: safe.topLeft,
      bottomRight: safe.bottomLeft,
    }).map(([x, y]): Pair => [-x, y]);
    ring = [...left, ...right.reverse().slice(1)];
  }
  return ring.map(([x, y]): Pair => [x + window.offset, y]);
}

function rect(u0: number, v0: number, u1: number, v1: number): Ring {
  return [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ];
}

/**
 * A reference divider piece with its notches and interior cutout window, in
 * the mesh's local space: X along the length, Y through the thickness, Z up
 * the installed height, all centred.
 */
export function referencePieceGeometry(
  length: number,
  height: number,
  thickness: number,
  notches: readonly ReferenceNotch[],
  window: PieceWindow,
  shape: WallCutoutShape
): THREE.BufferGeometry {
  const top = height / 2;
  const cuts: Ring[] = notches.map((n) =>
    n.fromTop
      ? rect(n.offset - n.width / 2, top - n.depth, n.offset + n.width / 2, top + PAST_EDGE)
      : rect(n.offset - n.width / 2, -top - PAST_EDGE, n.offset + n.width / 2, -top + n.depth)
  );
  cuts.push(windowOutline(shape, window, top));
  const outline = polygonClipping.difference(
    [rect(-length / 2, -top, length / 2, top)],
    ...cuts.map((ring) => [ring])
  );

  const toPath = <T extends THREE.Path>(path: T, ring: Ring): T => {
    // polygon-clipping repeats the first point at the end of every ring.
    const points = ring.slice(0, -1);
    path.moveTo(points[0][0], points[0][1]);
    for (const [u, v] of points.slice(1)) path.lineTo(u, v);
    return path;
  };
  const shapes = outline.map(([outer, ...holes]) => {
    const s = toPath(new THREE.Shape(), outer);
    s.holes = holes.map((hole) => toPath(new THREE.Path(), hole));
    return s;
  });

  const geometry = new THREE.ExtrudeGeometry(shapes, { depth: thickness, bevelEnabled: false });
  // Stand the outline up: its v becomes Z, and the extrusion runs along -Y.
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, thickness / 2, 0);
  return geometry;
}
