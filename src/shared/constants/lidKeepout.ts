/**
 * The bin↔lid interface envelope: the volume a seated lid claims inside the
 * bin's mouth, and the clearance stack that sizes it.
 *
 * The top of a bin's cavity belongs to the lid. A seated click rail hangs
 * `LID_CLICK_RAIL_BAND_BELOW_WALL_TOP` under the wall top and reaches inboard
 * of the inner wall face, so any interior feature that rises into that ring
 * collides with it — and until #3477 each such feature was discovered, and
 * worked around, one at a time.
 *
 * `lid.relieveInterior` cuts this envelope out of the interior as the LAST
 * operation on the bin, which is the whole point: tree order does the
 * enforcement, so a feature added later is trimmed without its author knowing
 * the lid exists. The per-feature rail notching stays for designs that predate
 * the flag.
 */

import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { maskEdgesMm, type MaskEdgeMm } from '@/shared/utils/maskEdgeGeometry';
import type { CellMask } from '@/shared/utils/cellMask';
import {
  LID_CLICK_RAIL_BAND_BELOW_WALL_TOP,
  LID_CLICK_RAIL_INNER,
  LID_CORNER_RADIUS,
  LID_FIT_CLEARANCE,
} from '@/features/bin-designer/types/lid';

/**
 * Clearance (mm) between the lid's swept volume and anything the bin keeps.
 *
 * The stack it comes from, per side:
 *
 * | term                          |   mm |
 * | ----------------------------- | ---- |
 * | lid-to-lip fit                | 0.25 | `LID_FIT_CLEARANCE`
 * | print tolerance, typical FDM  | 0.15 |
 * | warp across a 250mm part      | 0.50 | dominant term
 * |                               | 0.90 | → 1.0
 *
 * Warp dominates and is the reason this is not 0.4mm: a long bin's walls bow
 * inward as it cools, and a keep-out sized only to the nominal fit is consumed
 * by that alone.
 *
 * The per-feature notching margins (`LABEL_RAIL_MARGIN`, `DIVIDER_RAIL_MARGIN`,
 * `GRIP_RAIL_MARGIN`) are deliberately NOT re-derived from this. They now
 * affect only designs that predate `relieveInterior`, and re-tuning them would
 * regenerate published geometry for tidiness alone.
 */
export const LID_KEEPOUT_CLEARANCE = 1.0;

/**
 * How far BELOW THE INTERIOR CEILING the envelope reaches (mm).
 *
 * The ring is stated against the wall top; the cavity ceiling sits
 * `LIP_SMALL_TAPER` under that on a lipped bin, and a lid needs a lip, so this
 * is the only case. 3.45mm at the stock joint.
 *
 * The number a label shelf moves DOWN by. A shelf is the one interior feature
 * that legitimately wants the envelope's space — it hangs off the wall at the
 * rim — so trimming it would take away the weld that holds it, not the part in
 * the way. Its datum yields instead, which is the same rule stated from the
 * other side: features reference the interface, they are not cut by it.
 */
export const LID_KEEPOUT_BELOW_CEILING_MM =
  LID_CLICK_RAIL_BAND_BELOW_WALL_TOP + LID_KEEPOUT_CLEARANCE - GRIDFINITY_SPEC.LIP_SMALL_TAPER;

/** The envelope as a ring, in the bin's interior frame. */
export interface LidKeepoutRing {
  /** Half-extent of the ring's OUTER boundary from the interior centre. */
  readonly outerHalfX: number;
  readonly outerHalfY: number;
  /** Radial width, inward from that boundary. */
  readonly width: number;
  /** How far the ring reaches below the bin's wall top. */
  readonly depthBelowWallTop: number;
  /** Corner radius of the outer boundary. */
  readonly cornerRadius: number;
}

/**
 * How far inboard of the INNER WALL FACE a seated rail reaches (mm).
 *
 * The lid's outer half is `innerHalf + wallThickness + TOLERANCE/2 -
 * fitClearance`; the rail's spine sits `lidCornerR` inside that, and the
 * profile another `LID_CLICK_RAIL_INNER` (negative, i.e. inboard) past the
 * spine. 3.35mm at the 1.2mm default wall.
 *
 * Shared with `dividerRailPlan`, which needs the same number to decide whether
 * a divider line runs THROUGH a side rail rather than across it.
 */
export function railInboardReachMm(wallThickness: number): number {
  return -(
    wallThickness +
    GRIDFINITY_SPEC.TOLERANCE / 2 -
    LID_FIT_CLEARANCE -
    (LID_CORNER_RADIUS - LID_FIT_CLEARANCE) +
    LID_CLICK_RAIL_INNER
  );
}

/**
 * Radial width of the ring, inward from the lip's inner face.
 *
 * Depends on nothing but the wall, so a polygon footprint takes the same band
 * as a rectangle — the two differ in where the band is laid, never how deep it
 * reaches. Split out so {@link lidKeepoutSlabs} cannot drift from
 * {@link lidKeepoutRing}.
 */
export function lidKeepoutWidthMm(wallThickness: number): number {
  const lipInset = wallThickness - GRIDFINITY_SPEC.LIP_BIG_TAPER;
  // Both terms are measured from the INNER WALL FACE while the ring starts at
  // the lip line, so the jut is already spent: `lipInset` is negative and
  // adding it shortens the width by the head start.
  return railInboardReachMm(wallThickness) + LID_KEEPOUT_CLEARANCE + lipInset;
}

/**
 * How far inboard of the NOMINAL footprint outline the ring's outer boundary
 * sits, for a polygon edge.
 *
 * A mask outline spans the full grid-unit extent, so the bin's real outer face
 * is already `TOLERANCE / 2` inside it; the lip's inner face is a further
 * `LIP_BIG_TAPER` in. The rectangle path reaches the same line by a different
 * route (`innerW / 2 + lipInset` = `outerW / 2 - LIP_BIG_TAPER`), which is the
 * arithmetic `lidKeepoutSlabs` must agree with and the reason this is stated
 * once here.
 */
export const LID_KEEPOUT_OUTLINE_INSET_MM =
  GRIDFINITY_SPEC.TOLERANCE / 2 + GRIDFINITY_SPEC.LIP_BIG_TAPER;

/**
 * Resolve the keep-out ring for a bin's interior.
 *
 * Two bounds, both chosen so the cut can never touch what makes the joint work:
 *
 * - OUTER, at the stacking lip's inner face rather than the wall's. The lip
 *   juts into the cavity by `LIP_BIG_TAPER - wallThickness` (0.7mm at the
 *   default), and the void beneath that jut IS the undercut the rail's bump
 *   hooks. Starting the ring at the wall face would put the cutter over that
 *   material, and extending it upward to cut cleanly would then shave the
 *   undercut away and quietly disable the snap. Starting at the lip line
 *   leaves open air above the ring at every radius it spans, so the top can
 *   overshoot freely. The rail's own outer face sits 0.25mm inboard of this
 *   line, so nothing is given up.
 * - DEPTH, the rail band plus one clearance. Measured from the WALL TOP, which
 *   is what {@link LID_CLICK_RAIL_BAND_BELOW_WALL_TOP} is stated against, so a
 *   collar carries the whole envelope up with it for free.
 *
 * `innerW`/`innerD` are the pipeline's interior dimensions, overhang included.
 */
export function lidKeepoutRing(
  innerW: number,
  innerD: number,
  wallThickness: number
): LidKeepoutRing {
  // Distance from the interior centre out to the lip's inner face.
  const lipInset = wallThickness - GRIDFINITY_SPEC.LIP_BIG_TAPER;
  const outerHalfX = innerW / 2 + lipInset;
  const outerHalfY = innerD / 2 + lipInset;
  // Inward to the rail's deepest reach, plus clearance. Subtracting `lipInset`
  // instead of adding it makes the ring 2x0.7mm too wide, which cuts more
  // divider than the lid needs and passes every geometry check.
  const width = lidKeepoutWidthMm(wallThickness);
  return {
    outerHalfX,
    outerHalfY,
    width,
    depthBelowWallTop: LID_CLICK_RAIL_BAND_BELOW_WALL_TOP + LID_KEEPOUT_CLEARANCE,
    cornerRadius: Math.max(GRIDFINITY_SPEC.BOX_CORNER_RADIUS - GRIDFINITY_SPEC.LIP_BIG_TAPER, 0),
  };
}

/**
 * One axis-aligned band of the keep-out ring, in the bin's centred mm frame.
 *
 * Axis-aligned rather than "a centre plus a rotation" because a mask outline is
 * rectilinear, so every band already lies square to the axes and a rotation
 * would only be an opportunity to apply it backwards.
 */
export interface LidKeepoutSlab {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/**
 * The keep-out ring for a custom-shape footprint, as a union of per-edge bands.
 *
 * Deliberately NOT an inward offset of the outline (#3482 assumed one). For a
 * RECTILINEAR polygon the union of per-edge bands is exactly `outline` minus
 * `erode(outline, width)` under a square structuring element, and it turns each
 * of the offset's hard cases into something that needs no handling at all:
 *
 *  - A thin neck, where an offset self-intersects, merely has its bands overlap
 *    — and a neck narrower than twice the band IS entirely keep-out, which is
 *    what the erosion says too.
 *  - An inner loop, which an offset pushes the wrong way, carries its own
 *    winding; `maskEdgesMm` reads the inward normal off that, so a hole's bands
 *    face into the material like everyone else's.
 *  - A notch corner needs no clipping, because each band is already bounded by
 *    where its NEIGHBOURS' outer lines cross it.
 *
 * That last bound is the whole trick. Consecutive edges of a rectilinear
 * polygon are perpendicular, so a neighbour's outer line is perpendicular to
 * this edge and meets it at `inset * (neighbourNormal · thisDirection)` from
 * the shared vertex. The dot product is +1 at a convex corner (pull the band
 * back) and -1 at a reflex one (push it past the vertex), which is exactly how
 * an erosion behaves at each.
 *
 * The bands alone are NOT the whole ring, though, and the shortfall is only at
 * a reflex vertex. A point tucked diagonally into such a corner can sit further
 * than the band from BOTH edges while still being within the band's reach of
 * the void along the diagonal — measured at 3mm from one edge and 4mm from the
 * other on a stock L, against a 5.8mm reach. An erosion removes it; two
 * perpendicular bands miss it, and the miss is a wedge of un-relieved material
 * exactly where an L-shaped bin's inner corner meets the lid. {@link
 * reflexCornerSlab} fills it, and nothing analogous is needed at a convex
 * vertex, where the two bands already overlap.
 *
 * Returns nothing when the band would be wider than the footprint has room for,
 * matching the rectangle path's own degenerate guard.
 */
export function lidKeepoutSlabs(
  mask: CellMask,
  gridUnitMm: number,
  gridUnitMmY: number,
  wallThickness: number
): readonly LidKeepoutSlab[] {
  const width = lidKeepoutWidthMm(wallThickness);
  if (width <= 0) return [];
  const inset = LID_KEEPOUT_OUTLINE_INSET_MM;

  const edges = maskEdgesMm(mask, gridUnitMm, gridUnitMmY);
  const out: LidKeepoutSlab[] = [];

  // Neighbours are the previous/next edge WITHIN the same loop, so a hole's
  // corners are bounded by the hole's own edges rather than by whichever outer
  // edge happens to sit next in the flat list.
  const byLoop = new Map<number, MaskEdgeMm[]>();
  for (const e of edges) {
    const list = byLoop.get(e.loop);
    if (list) list.push(e);
    else byLoop.set(e.loop, [e]);
  }

  for (const loop of byLoop.values()) {
    const n = loop.length;
    for (let i = 0; i < n; i++) {
      const e = loop[i];
      const prev = loop[(i - 1 + n) % n];
      const next = loop[(i + 1) % n];
      const alongStart = inset * (prev.inX * e.dirX + prev.inY * e.dirY);
      const alongEnd = e.length + inset * (next.inX * e.dirX + next.inY * e.dirY);
      if (alongEnd - alongStart <= 0.1) continue;

      // Two corners of the band: the near and far ends of the surviving run,
      // each pushed inward off the outline by the inset and then by the width.
      const ax = e.fromX + e.dirX * alongStart + e.inX * inset;
      const ay = e.fromY + e.dirY * alongStart + e.inY * inset;
      const bx = e.fromX + e.dirX * alongEnd + e.inX * (inset + width);
      const by = e.fromY + e.dirY * alongEnd + e.inY * (inset + width);
      out.push({
        minX: Math.min(ax, bx),
        maxX: Math.max(ax, bx),
        minY: Math.min(ay, by),
        maxY: Math.max(ay, by),
      });

      // The vertex this edge STARTS at, so every corner of the loop is visited
      // once. Material is on the left of every edge, so a right turn is the
      // reflex one whichever loop this is — reading the turn rather than the
      // winding is what keeps a hole's corners from being classified backwards.
      const turn = prev.dirX * e.dirY - prev.dirY * e.dirX;
      if (turn < 0) {
        const corner = reflexCornerSlab(prev, e, inset, width);
        if (corner) out.push(corner);
      }
    }
  }
  return out;
}

/**
 * The diagonal wedge two bands leave open at a reflex vertex.
 *
 * Spans `inset` to `inset + width` along BOTH edges' inward normals, which is
 * precisely the set that is deeper than either band reaches yet still within
 * the ring's reach of the corner. Squared off rather than rounded because
 * everything else here is, and because the lid's own shell turns the same
 * corner.
 */
function reflexCornerSlab(
  prev: MaskEdgeMm,
  next: MaskEdgeMm,
  inset: number,
  width: number
): LidKeepoutSlab | null {
  // The shared vertex: where `prev` ends and `next` begins.
  const vx = next.fromX;
  const vy = next.fromY;
  const near = inset;
  const far = inset + width;
  // Each normal is axis-aligned, so the two contribute to different axes and
  // the four combinations are just the corners of an axis-aligned square.
  const xs = [vx + prev.inX * near + next.inX * near, vx + prev.inX * far + next.inX * far];
  const ys = [vy + prev.inY * near + next.inY * near, vy + prev.inY * far + next.inY * far];
  const minX = Math.min(xs[0], xs[1]);
  const maxX = Math.max(xs[0], xs[1]);
  const minY = Math.min(ys[0], ys[1]);
  const maxY = Math.max(ys[0], ys[1]);
  if (maxX - minX <= 0.1 || maxY - minY <= 0.1) return null;
  return { minX, maxX, minY, maxY };
}
