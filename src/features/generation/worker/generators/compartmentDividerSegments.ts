/** Interior divider wall segments: where each runs, and the straight or tilted prism that builds it. */

import { box, unwrap, draw, intersect, rotate, translate, applyMatrix } from 'brepjs';
import type { Shape3D, ValidSolid, DisposalScope } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
// Pure grid helpers, kept in the compartment-grid util so the main thread can
// reach them too — the lid's click rails notch around the same runs
// and cannot import this module, which pulls in brepjs.
import {
  buildOverrideLookup,
  dividerFootDrift,
  findPairAwareRuns,
  overrideKey,
} from '@/shared/types/bin';

import { sketch } from './meshUtils';

// Re-export for backwards compatibility with existing imports

/** One divider wall segment: its top line, how far its foot leans off that
 *  line, and the interior it gets clipped to. */
interface WallSegmentPlan {
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  /** Foot displacement from the top line, along the offset axis. Zero stands
   *  the wall upright. */
  readonly driftX: number;
  readonly driftY: number;
  readonly thickness: number;
  readonly height: number;
  readonly binInnerW: number;
  readonly binInnerD: number;
}

/**
 * Build a tilted divider wall whose top edge runs from `(startX, startY)` to
 * `(endX, endY)` and whose foot edge is that top edge translated by the plan's
 * full drift vector. Thickness is applied perpendicular to the wall PLANE (not
 * world-aligned) so the divider reads as a tilted ribbon of constant thickness,
 * not a squished box — true even when the wall is both angled in plan and leaned
 * off vertical (a general oblique parallelepiped, not just a parallelogram
 * prism).
 *
 * Clipped to the bin interior so any corners that overshoot the bin wall (which
 * happens whenever the tilt is non-zero) are sliced cleanly at the wall plane.
 */
export function buildTiltedWallSegment(
  scope: DisposalScope,
  plan: WallSegmentPlan
): Shape3D | null {
  const { startX, startY, endX, endY, thickness, height, binInnerW, binInnerD } = plan;
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.hypot(dx, dy);
  // Degenerate-segment guard: a zero-length divider (both endpoints
  // collapsed to the same point — possible if a malformed override drives
  // a span to nothing) would divide by zero and produce NaN geometry.
  if (len < 1e-6) return null;
  // Perpendicular unit vector (rotated 90° CCW from the divider direction).
  const px = -dy / len;
  const py = dx / len;
  const half = thickness / 2;

  // Split the foot's drift into components across and along the run. The foot
  // line is the top line translated by the full drift vector, so BOTH matter:
  // `across` leans the wall off vertical; `along` shears it lengthwise (the
  // foot line slides parallel to itself down the run). When a divider is only
  // angled OR only leaned `along` is zero, but combine Angle and Lean and the
  // offset axis no longer lines up with the run, so a real along-run component
  // appears. Dropping it (keeping only `across`) is what put a compound
  // divider's foot outside the bin: the wall then leaned the wrong way and the
  // interior clip sliced it into a wedge.
  const leanAcross = plan.driftX * px + plan.driftY * py;
  const driftAlong = (plan.driftX * dx + plan.driftY * dy) / len;

  let prism: Shape3D;
  if (leanAcross === 0 && driftAlong === 0) {
    const pen = draw([startX + px * half, startY + py * half])
      .lineTo([endX + px * half, endY + py * half])
      .lineTo([endX - px * half, endY - py * half])
      .lineTo([startX - px * half, startY - py * half])
      .close();
    prism = scope.register(sketch(pen, 'XY', 0).extrude(height));
  } else {
    // `buildLeaningPrism` builds the across-run lean in a canonical frame (run
    // along +X, top edge on the X axis at `height`), preserving perpendicular
    // thickness. The along-run drift is then a shear parallel to the run,
    // `x += driftAlong · (1 − z/height)`: the top edge (z=height) stays put and
    // the foot (z=0) slides `driftAlong` down +X. Because the shear direction
    // lies in the wall plane, it does not change the plane's normal and so keeps
    // the perpendicular thickness exactly `thickness` (see __kernel-tests__/
    // dividerRake). Composing lean + shear reproduces the true foot line where a
    // single rigid tilt cannot.
    const canonical = scope.register(buildLeaningPrism(len, leanAcross, thickness, height));
    const sheared =
      driftAlong === 0
        ? canonical
        : scope.register(
            unwrap(
              applyMatrix(canonical, [
                [1, 0, -driftAlong / height, driftAlong],
                [0, 1, 0, 0],
                [0, 0, 1, 0],
                [0, 0, 0, 1],
              ])
            )
          );
    const oriented = scope.register(
      rotate(sheared, (Math.atan2(dy, dx) * 180) / Math.PI, { axis: [0, 0, 1] })
    );
    prism = scope.register(translate(oriented, [(startX + endX) / 2, (startY + endY) / 2, 0]));
  }
  // Clip the parallelogram corners that overshoot the bin's perpendicular
  // wall. For zero-tilt segments the clip is a no-op; for tilted segments
  // it shears off the "ears" that would otherwise poke through the wall.
  // If the prism is entirely outside the clip box (override pushes the
  // divider beyond the bin interior), the intersect returns nothing — bail
  // gracefully rather than crashing the whole bin build.
  const clipBox = scope.register(box(binInnerW, binInnerD, height, { at: [0, 0, height / 2] }));
  try {
    return scope.register(unwrap(intersect(prism as ValidSolid, clipBox)));
  } catch {
    return null;
  }
}

/**
 * A leaning wall in canonical pose: run along +X centred on the origin, top
 * edge on the X axis at `height`, foot displaced `leanAcross` in +Y.
 *
 * The section is a parallelogram with flat ends at z=0 and z=height and
 * horizontal half-width `t/2 · L/height`, which is what keeps the distance
 * between its two slanted faces at exactly `thickness` however far it leans.
 * Sizing the section on the plan footprint instead thins the wall by
 * cos(lean), taking a 1.6mm divider under two perimeters at 45°.
 */
function buildLeaningPrism(
  len: number,
  leanAcross: number,
  thickness: number,
  height: number
): Shape3D {
  const half = (thickness / 2) * (Math.hypot(leanAcross, height) / height);
  // 2D sketch axes on YZ are (world Y, world Z); the extrude runs along +X.
  const section = draw([-half, height])
    .lineTo([half, height])
    .lineTo([leanAcross + half, 0])
    .lineTo([leanAcross - half, 0])
    .close();
  return section.sketchOnPlane('YZ', -len / 2).extrude(len);
}

/** One interior divider wall segment, resolved to mm in bin-centered coords. */
export interface InteriorDividerSegment {
  /** Axis-projected segment length (mm) — not the longer true diagonal. */
  readonly segLen: number;
  /** True wall length along the (possibly tilted) segment — equals `segLen`
   *  for straight dividers, longer for tilted ones. Features that measure
   *  distance ALONG the wall (cutout width, alignment) must use this, not the
   *  projected `segLen`. */
  readonly wallLen: number;
  readonly x: number;
  readonly y: number;
  /** In-plane rotation (deg) aligned to the wall: 90 for straight vertical
   *  dividers, 0 for straight horizontal, tilted by the override otherwise. */
  readonly rotateZ: number;
  /** Lean off vertical (deg). `x`/`y` describe the wall's TOP edge, so any
   *  feature that reaches below the rim has to answer for this: on a leaning
   *  divider the wall is simply not at `x`/`y` further down. */
  readonly leanDeg: number;
  /** Where the wall meets the FLOOR. Equals `x`/`y` when it stands upright. */
  readonly footX: number;
  readonly footY: number;
}

/**
 * Enumerate every interior divider wall segment with its tilt-resolved
 * placement, honouring `dividerOverrides`. Shared source of truth so features
 * that decorate dividers (wall cutouts, handles) land ON the wall instead of at
 * the original grid line when a divider is tilted. Pure — no WASM.
 */
export function interiorDividerSegments(
  params: BinParams,
  innerW: number,
  innerD: number,
  dividerHeight: number
): InteriorDividerSegment[] {
  const { cols, rows, cells } = params.compartments;
  const out: InteriorDividerSegment[] = [];
  if (cols <= 1 && rows <= 1) return out;

  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const lookup = buildOverrideLookup(params.compartments.dividerOverrides);
  const RAD2DEG = 180 / Math.PI;

  // Without overrides, merge contiguous wall cells into one run (historical
  // behavior — one window per span). Only split per compartment pair when tilts
  // exist, since each tilted pair is its own angled wall segment.
  const hasOverrides = lookup.size > 0;
  const runsFor = (
    count: number,
    pairOf: (i: number) => string | null
  ): Array<{ start: number; end: number; pairKey: string }> =>
    hasOverrides
      ? findPairAwareRuns(count, pairOf)
      : findWallSegments(count, (i) => pairOf(i) !== null).map(([start, end]) => ({
          start,
          end,
          pairKey: '',
        }));

  // Vertical dividers (between columns) run along Y; straight ⇒ rotateZ 90.
  for (let boundary = 1; boundary < cols; boundary++) {
    const xPos = -innerW / 2 + boundary * cellW;
    const runs = runsFor(rows, (row) => {
      const leftId = cells[row * cols + (boundary - 1)];
      const rightId = cells[row * cols + boundary];
      return leftId !== rightId ? overrideKey(leftId, rightId) : null;
    });
    for (const { start, end, pairKey } of runs) {
      const segLen = (end - start) * cellD;
      const midY = -innerD / 2 + (start + (end - start) / 2) * cellD;
      const ov = lookup.get(pairKey);
      out.push(
        ov
          ? (() => {
              const x = xPos + (ov.offsetStart + ov.offsetEnd) / 2;
              return {
                segLen,
                wallLen: Math.hypot(segLen, ov.offsetEnd - ov.offsetStart),
                x,
                y: midY,
                rotateZ: Math.atan2(segLen, ov.offsetEnd - ov.offsetStart) * RAD2DEG,
                leanDeg: ov.rakeDeg ?? 0,
                footX: x + dividerFootDrift(ov, dividerHeight),
                footY: midY,
              };
            })()
          : {
              segLen,
              wallLen: segLen,
              x: xPos,
              y: midY,
              rotateZ: 90,
              leanDeg: 0,
              footX: xPos,
              footY: midY,
            }
      );
    }
  }

  // Horizontal dividers (between rows) run along X; straight ⇒ rotateZ 0.
  for (let boundary = 1; boundary < rows; boundary++) {
    const yPos = -innerD / 2 + boundary * cellD;
    const runs = runsFor(cols, (col) => {
      const topId = cells[(boundary - 1) * cols + col];
      const bottomId = cells[boundary * cols + col];
      return topId !== bottomId ? overrideKey(topId, bottomId) : null;
    });
    for (const { start, end, pairKey } of runs) {
      const segLen = (end - start) * cellW;
      const midX = -innerW / 2 + (start + (end - start) / 2) * cellW;
      const ov = lookup.get(pairKey);
      out.push(
        ov
          ? (() => {
              const y = yPos + (ov.offsetStart + ov.offsetEnd) / 2;
              return {
                segLen,
                wallLen: Math.hypot(segLen, ov.offsetEnd - ov.offsetStart),
                x: midX,
                y,
                rotateZ: Math.atan2(ov.offsetEnd - ov.offsetStart, segLen) * RAD2DEG,
                leanDeg: ov.rakeDeg ?? 0,
                footX: midX,
                footY: y + dividerFootDrift(ov, dividerHeight),
              };
            })()
          : {
              segLen,
              wallLen: segLen,
              x: midX,
              y: yPos,
              rotateZ: 0,
              leanDeg: 0,
              footX: midX,
              footY: yPos,
            }
      );
    }
  }
  return out;
}

/**
 * Find consecutive wall segments along a boundary line.
 * Returns array of [start, end) index pairs where walls are needed.
 */
export function findWallSegments(
  count: number,
  needsWall: (i: number) => boolean
): Array<[number, number]> {
  const segments: Array<[number, number]> = [];
  let segStart: number | null = null;

  for (let i = 0; i < count; i++) {
    if (needsWall(i)) {
      if (segStart === null) segStart = i;
    } else if (segStart !== null) {
      segments.push([segStart, i]);
      segStart = null;
    }
  }
  if (segStart !== null) {
    segments.push([segStart, count]);
  }
  return segments;
}
