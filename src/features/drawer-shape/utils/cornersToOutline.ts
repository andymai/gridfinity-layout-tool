/**
 * Per-corner cuts → drawer outline (issue #2528, corners authoring surface).
 *
 * Cuts apply to the drawer RECTANGLE (composing cuts onto arbitrary shapes is
 * a later nicety — the section confirms before replacing a non-corner
 * outline). Radius cuts emit real arcs: a quarter circle is bulge
 * tan(π/8) ≈ 0.4142, positive because the arc bows right of CCW travel —
 * away from the interior, i.e. a rounded corner.
 */

import type {
  CornerCut,
  CornerCutParams,
  Drawer,
  DrawerOutline,
  OutlineVertex,
} from '@/core/types';

/** Bulge of a 90° arc: tan(sweep/4) with sweep = π/2. */
const QUARTER_ARC_BULGE = Math.tan(Math.PI / 8);

export const NO_CUTS: CornerCutParams = {
  tl: { kind: 'none' },
  tr: { kind: 'none' },
  bl: { kind: 'none' },
  br: { kind: 'none' },
};

/** Largest chamfer/radius/notch extent (mm) that keeps cuts from meeting. */
export function maxCutExtentMm(drawer: Drawer, gridUnitMm: number): number {
  const widthMm = (drawer.width as number) * gridUnitMm;
  const depthMm = (drawer.depth as number) * gridUnitMm;
  return Math.floor(Math.min(widthMm, depthMm) / 2 - 1);
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
 * Build the outline for the drawer rectangle with the given corner cuts, or
 * null when every corner is 'none' (the caller clears the outline — the
 * plain rectangle is represented by ITS absence).
 */
export function cornersToOutline(
  drawer: Drawer,
  cuts: CornerCutParams,
  gridUnitMm: number
): DrawerOutline | null {
  if (
    cuts.tl.kind === 'none' &&
    cuts.tr.kind === 'none' &&
    cuts.bl.kind === 'none' &&
    cuts.br.kind === 'none'
  ) {
    return null;
  }
  const W = (drawer.width as number) * gridUnitMm;
  const D = (drawer.depth as number) * gridUnitMm;

  // CCW walk bl → br → tr → tl. Entry/exit directions per corner:
  const vertices: OutlineVertex[] = [
    // bl: arrive DOWN the left edge, leave RIGHT along the bottom.
    ...cornerVertices(cuts.bl, { x: 0, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }),
    // br: arrive RIGHT, leave UP.
    ...cornerVertices(cuts.br, { x: W, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }),
    // tr: arrive UP, leave LEFT.
    ...cornerVertices(cuts.tr, { x: W, y: D }, { x: 0, y: 1 }, { x: -1, y: 0 }),
    // tl: arrive LEFT, leave DOWN.
    ...cornerVertices(cuts.tl, { x: 0, y: D }, { x: -1, y: 0 }, { x: 0, y: -1 }),
  ];

  return { vertices, authoring: { kind: 'corners', corners: cuts } };
}
