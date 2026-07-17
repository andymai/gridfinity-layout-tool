/**
 * Corner-cut → outline vertex geometry, shared by the drawer-shape editor
 * (cuts inscribed on the drawer rectangle) and the baseplate param resolver
 * (the same cuts re-inscribed on the padded plate rectangle, and large corner
 * radii converted to radius cuts).
 *
 * Radius cuts emit real arcs: a quarter circle is bulge tan(π/8) ≈ 0.4142,
 * positive because the arc bows right of CCW travel — away from the interior,
 * i.e. a rounded corner.
 */

import type { CornerCut, CornerCutParams, OutlineVertex } from '@/core/types';

/** Bulge of a 90° arc: tan(sweep/4) with sweep = π/2. */
const QUARTER_ARC_BULGE = Math.tan(Math.PI / 8);

export function hasAnyCut(cuts: CornerCutParams): boolean {
  return (
    cuts.tl.kind !== 'none' ||
    cuts.tr.kind !== 'none' ||
    cuts.bl.kind !== 'none' ||
    cuts.br.kind !== 'none'
  );
}

function extent(cut: CornerCut): { x: number; y: number } {
  switch (cut.kind) {
    case 'none':
      return { x: 0, y: 0 };
    case 'chamfer':
      return { x: cut.size, y: cut.size };
    case 'radius':
      return { x: cut.r, y: cut.r };
    case 'notch':
      return { x: cut.w, y: cut.d };
  }
}

/**
 * Clamp each cut's extents so opposing cuts can never meet or cross on a
 * rectangle of the given size. Guards resolver-side regeneration against
 * stored cut sizes that outgrew a since-shrunk rectangle.
 */
export function clampCornerCuts(
  cuts: CornerCutParams,
  widthMm: number,
  depthMm: number,
  marginMm: number
): CornerCutParams {
  const max = Math.min(widthMm, depthMm) / 2 - marginMm;
  const clampCut = (cut: CornerCut): CornerCut => {
    switch (cut.kind) {
      case 'none':
        return cut;
      case 'chamfer':
        return cut.size > max ? { kind: 'chamfer', size: max } : cut;
      case 'radius':
        return cut.r > max ? { kind: 'radius', r: max } : cut;
      case 'notch':
        return cut.w > max || cut.d > max
          ? { kind: 'notch', w: Math.min(cut.w, max), d: Math.min(cut.d, max) }
          : cut;
    }
  };
  return {
    tl: clampCut(cuts.tl),
    tr: clampCut(cuts.tr),
    bl: clampCut(cuts.bl),
    br: clampCut(cuts.br),
  };
}

/**
 * Emit the CCW vertex run for one corner. `corner` is the corner point;
 * `entry` and `exit` are unit directions along the incoming and outgoing
 * edges of the CCW walk (entry points TOWARD the corner, exit AWAY from it).
 * The cut is inscribed by backing `entry` off by the cut extent and advancing
 * along `exit` by it.
 */
function cornerVertices(
  cut: CornerCut,
  corner: { x: number; y: number },
  entry: { x: number; y: number },
  exit: { x: number; y: number }
): OutlineVertex[] {
  if (cut.kind === 'none') return [{ x: corner.x, y: corner.y }];
  const e = extent(cut);
  // Back off along the entry axis by that axis's extent; advance along exit.
  const entryDist = Math.abs(entry.x) > 0 ? e.x : e.y;
  const exitDist = Math.abs(exit.x) > 0 ? e.x : e.y;
  const from = { x: corner.x - entry.x * entryDist, y: corner.y - entry.y * entryDist };
  const to = { x: corner.x + exit.x * exitDist, y: corner.y + exit.y * exitDist };
  switch (cut.kind) {
    case 'chamfer':
      return [
        { x: from.x, y: from.y },
        { x: to.x, y: to.y },
      ];
    case 'radius':
      return [
        { x: from.x, y: from.y, bulge: QUARTER_ARC_BULGE },
        { x: to.x, y: to.y },
      ];
    case 'notch': {
      // Step inward: from → inner corner → to.
      const inner = { x: from.x + exit.x * exitDist, y: from.y + exit.y * exitDist };
      return [
        { x: from.x, y: from.y },
        { x: inner.x, y: inner.y },
        { x: to.x, y: to.y },
      ];
    }
  }
}

/**
 * CCW vertex loop for a widthMm × depthMm rectangle (origin bottom-left) with
 * the given corner cuts inscribed. Corner naming is y-up: tl/tr are the BACK
 * corners.
 */
export function cornerCutVertices(
  widthMm: number,
  depthMm: number,
  cuts: CornerCutParams
): OutlineVertex[] {
  const W = widthMm;
  const D = depthMm;
  // CCW walk bl → br → tr → tl. Entry/exit directions per corner:
  return [
    // bl: arrive DOWN the left edge, leave RIGHT along the bottom.
    ...cornerVertices(cuts.bl, { x: 0, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }),
    // br: arrive RIGHT, leave UP.
    ...cornerVertices(cuts.br, { x: W, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }),
    // tr: arrive UP, leave LEFT.
    ...cornerVertices(cuts.tr, { x: W, y: D }, { x: 0, y: 1 }, { x: -1, y: 0 }),
    // tl: arrive LEFT, leave DOWN.
    ...cornerVertices(cuts.tl, { x: 0, y: D }, { x: -1, y: 0 }, { x: 0, y: -1 }),
  ];
}

/**
 * True when `outline.vertices` is the loop `cornerCutVertices` produces for
 * these cuts at this size — i.e. the authoring echo still matches the stored
 * geometry, so the resolver may regenerate the same cuts at a padded size.
 * Tolerances cover the store's quantization (0.01mm) and bounds snap (0.05mm).
 */
export function cornerCutsMatchVertices(
  vertices: readonly OutlineVertex[],
  widthMm: number,
  depthMm: number,
  cuts: CornerCutParams
): boolean {
  const expected = cornerCutVertices(widthMm, depthMm, cuts);
  if (vertices.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    const a = vertices[i];
    const b = expected[i];
    if (Math.abs(a.x - b.x) > 0.06 || Math.abs(a.y - b.y) > 0.06) return false;
    if (Math.abs((a.bulge ?? 0) - (b.bulge ?? 0)) > 1e-5) return false;
  }
  return true;
}
