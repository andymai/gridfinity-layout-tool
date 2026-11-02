import { cut, draw, fuse, intersect, translate, unwrap } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { Cutout } from '@/shared/types/bin';
import { sketch } from './meshUtils';

type Split = NonNullable<Cutout['split']>;

/** Depths closer than this cut as one (mm). */
const SAME_DEPTH_MM = 1e-6;

/**
 * A split pocket's tool in its own frame, mouth at z = the deeper side's depth.
 *
 * Each side is its own full tool, the shallow one raised so both mouths meet,
 * trimmed to its side of the line by one prism: the deep tool keeps what lies
 * inside it, the shallow tool what lies outside. The two halves then touch only
 * on the flat face the prism gives them both, never along the pocket's curved
 * or lofted walls, where coincident faces are what leave a boolean
 * non-manifold. `tool(depth)` builds the whole pocket at one depth.
 */
export function buildSplitTool(
  cutout: Cutout,
  split: Split,
  depthA: number,
  depthB: number,
  tool: (depth: number) => Shape3D | null
): Shape3D | null {
  if (Math.abs(depthA - depthB) < SAME_DEPTH_MM) return tool(depthA);
  const deepIsB = depthB > depthA;
  const deep = Math.max(depthA, depthB);
  const shallow = Math.min(depthA, depthB);

  const deepTool = tool(deep);
  const shallowTool = tool(shallow);
  if (!deepTool || !shallowTool) {
    deepTool?.delete();
    shallowTool?.delete();
    return null;
  }
  const raised = translate(shallowTool, [0, 0, deep - shallow]);
  shallowTool.delete();
  const prism = splitSidePrism(cutout, split, deepIsB, -1, deep + 1);
  try {
    const deepHalf = unwrap(intersect(deepTool, prism));
    const shallowHalf = unwrap(cut(raised, prism));
    try {
      return unwrap(fuse(deepHalf, shallowHalf));
    } finally {
      deepHalf.delete();
      shallowHalf.delete();
    }
  } finally {
    deepTool.delete();
    raised.delete();
    prism.delete();
  }
}

/**
 * A prism over one side of the line in the cutout's own frame, from `zMin` to
 * `zMax` and past the pocket on every other side: right of `a` to `b` for side
 * B, left for side A.
 */
export function splitSidePrism(
  cutout: Cutout,
  split: Split,
  sideB: boolean,
  zMin: number,
  zMax: number
): Shape3D {
  const { a, b } = split;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  // Left of a to b is (-uy, ux); side B lies the other way.
  const nx = sideB ? uy : -uy;
  const ny = sideB ? -ux : ux;
  const reach =
    2 * (cutout.width + cutout.depth) +
    Math.hypot(a.x, a.y) +
    Math.hypot(b.x, b.y) +
    (cutout.clearance ?? 0) +
    (cutout.chamferWidth ?? 0) +
    10;
  const s = { x: a.x - ux * reach, y: a.y - uy * reach };
  const e = { x: a.x + ux * reach, y: a.y + uy * reach };
  const outline = draw([s.x, s.y])
    .lineTo([e.x, e.y])
    .lineTo([e.x + nx * reach, e.y + ny * reach])
    .lineTo([s.x + nx * reach, s.y + ny * reach])
    .close();
  const prism = sketch(outline, 'XY').extrude(zMax - zMin);
  const placed = translate(prism, [0, 0, zMin]);
  prism.delete();
  return placed;
}
