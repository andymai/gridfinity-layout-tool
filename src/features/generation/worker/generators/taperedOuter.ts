/**
 * Bottom-band outer-wall taper for drawer-fit "curved" bins (#2933).
 *
 * Builds the bin's hollow body when a taper applies: the wall is full-width at
 * the rim and, over `taper.bandHeight` (clamped to the wall height), angles
 * inward on each tapered side toward the nominal footprint. The outer body and
 * the inner cavity are each a ruled multi-section loft (the same idiom as the
 * socket profile) and the cavity is `cut` from the outer — NOT `shell()`, which
 * is unreliable on a non-prismatic (tapered) solid. Because both surfaces carry
 * the same per-side inset, wall thickness stays uniform.
 *
 * Chamfer uses two band sections (a straight facet); fillet samples a concave
 * quarter-ellipse. Sections at/above the band repeat the rim, so the upper wall
 * is a straight prism and the top rim stays full-size — the stacking lip seats
 * there untouched.
 */

import { drawRoundedRectangle, cut, unwrap } from 'brepjs';
import type { Shape3D, Sketch, ValidSolid, DisposalScope } from 'brepjs';
import { BOX_CORNER_RADIUS, COPLANAR_MARGIN } from './generatorTypes';
import type { ResolvedTaper } from './overhang';

const FILLET_SECTIONS = 6;

export function buildTaperedBox(
  scope: DisposalScope,
  outerW: number,
  outerD: number,
  wallHeight: number,
  wallThickness: number,
  taper: ResolvedTaper,
  offX: number,
  offY: number
): Shape3D {
  const band = Math.min(taper.bandHeight, wallHeight);

  // Per-side inset at height z: full at the base, zero at/above the band top.
  const insetAt = (side: number, z: number): number => {
    if (side <= 0 || z >= band) return 0;
    const u = 1 - z / band; // 1 at base → 0 at band top
    return taper.profile === 'chamfer' ? side * u : side * (1 - Math.sqrt(Math.max(0, 1 - u * u))); // concave quarter-ellipse
  };

  // A rounded-rect section at height z, shrunk uniformly by `shrink` (0 for the
  // outer body, `wallThickness` for the inner cavity).
  const section = (z: number, shrink: number): Sketch => {
    const il = insetAt(taper.left, z);
    const ir = insetAt(taper.right, z);
    const iFront = insetAt(taper.front, z);
    const ib = insetAt(taper.back, z);
    const w = Math.max(outerW - il - ir - 2 * shrink, 0.2);
    const d = Math.max(outerD - iFront - ib - 2 * shrink, 0.2);
    // Asymmetric insets shift the section center; add the overhang recenter.
    const cx = offX + (il - ir) / 2;
    const cy = offY + (iFront - ib) / 2;
    const r = Math.max(Math.min(BOX_CORNER_RADIUS - shrink, w / 2 - 0.1, d / 2 - 0.1), 0.1);
    return drawRoundedRectangle(w, d, r).translate(cx, cy).sketchOnPlane('XY', z) as Sketch;
  };

  // z-levels from `bottom` to `top`: chamfer needs only the band break; fillet
  // samples the curve. Near-duplicate levels are dropped (zero-height segments).
  // Subdivide the band ONCE from a shared origin, so the outer body and the
  // cavity sample the profile at identical heights. For the nonlinear fillet
  // that alignment is what keeps wall thickness uniform — sampling the two lofts
  // from different origins would leave their piecewise-linear faces non-parallel.
  // Chamfer is linear, so it needs only the band break.
  const bandLevels =
    taper.profile === 'chamfer'
      ? [0, band]
      : Array.from({ length: FILLET_SECTIONS + 1 }, (_, i) => (band * i) / FILLET_SECTIONS);

  const loft = (zs: number[], shrink: number): Shape3D => {
    const uniq = zs.filter((z, i) => i === 0 || z - zs[i - 1] > 1e-6);
    const sections = uniq.map((z) => section(z, shrink));
    return sections[0].loftWith(sections.slice(1), { ruled: true });
  };

  // Outer runs floor→rim. The cavity reuses the shared band nodes above the
  // floor (keeping its face parallel to the outer), starts a floor-thickness up,
  // and overshoots the top so the cut opens the rim.
  const outer = scope.register(loft([...bandLevels, wallHeight], 0));
  const cavity = scope.register(
    loft(
      [wallThickness, ...bandLevels.filter((z) => z > wallThickness), wallHeight + COPLANAR_MARGIN],
      wallThickness
    )
  );
  return unwrap(cut(outer as ValidSolid, cavity as ValidSolid));
}
