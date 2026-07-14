/**
 * Placement math for a cutout's engraved label.
 *
 * Single source of truth shared by the generation engraver
 * (`buildCutoutLabelEngrave`) and the 2D cutout-editor preview
 * (`CutoutLabel3D`) so the on-screen label tracks the printed engraving.
 */

import type { Cutout, CutoutTextAnchor } from '@/shared/types/bin';

export interface CutoutAabb {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/**
 * Rotation-aware world-coord AABB for a positioned cutout. Projects the four
 * rotated corners (rather than a diagonal-based safe box) so a label placed
 * against an edge never overlaps a rotated cutout's footprint.
 *
 * `originX`/`originY` shift the interior-frame origin: the 2D editor passes 0
 * (interior corner origin), generation passes `-innerW/2, -innerD/2` (the
 * bin body is centered on the model origin).
 */
export function cutoutWorldAabb(
  cutout: Pick<Cutout, 'x' | 'y' | 'width' | 'depth' | 'rotation'>,
  originX: number,
  originY: number
): CutoutAabb {
  const cx = originX + cutout.x + cutout.width / 2;
  const cy = originY + cutout.y + cutout.depth / 2;
  const hw = cutout.width / 2;
  const hd = cutout.depth / 2;
  if (cutout.rotation === 0) {
    return { minX: cx - hw, maxX: cx + hw, minY: cy - hd, maxY: cy + hd };
  }
  const theta = (cutout.rotation * Math.PI) / 180;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [lx, ly] of [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ] as const) {
    const wx = cx + lx * c - ly * s;
    const wy = cy + lx * s + ly * c;
    if (wx < minX) minX = wx;
    if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy;
    if (wy > maxY) maxY = wy;
  }
  return { minX, maxX, minY, maxY };
}

export interface CutoutLabelPlacement {
  /** Center of the available band, in the same frame as the origin args. */
  readonly centerX: number;
  readonly centerY: number;
  /** Available width/depth of the band in mm (margin not yet subtracted). */
  readonly availW: number;
  readonly availD: number;
}

/** One axis of the 3×3 anchor grid: `low`/`high` are the outer gaps, `center`
 *  spans the cutout's own footprint on that axis. */
type Zone = 'low' | 'center' | 'high';

const ANCHOR_ZONES: Record<CutoutTextAnchor, { h: Zone; v: Zone }> = {
  'top-left': { h: 'low', v: 'high' },
  top: { h: 'center', v: 'high' },
  'top-right': { h: 'high', v: 'high' },
  left: { h: 'low', v: 'center' },
  center: { h: 'center', v: 'center' },
  right: { h: 'high', v: 'center' },
  'bottom-left': { h: 'low', v: 'low' },
  bottom: { h: 'center', v: 'low' },
  'bottom-right': { h: 'high', v: 'low' },
};

/**
 * Effective 9-point anchor: explicit `textAnchor` wins; otherwise the legacy
 * `textSide` migrates onto its edge-center anchor; otherwise `'top'`.
 */
export function resolveCutoutTextAnchor(
  cutout: Pick<Cutout, 'textAnchor' | 'textSide'>
): CutoutTextAnchor {
  if (cutout.textAnchor) return cutout.textAnchor;
  // Reading the deprecated field is the migration path it exists for.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  switch (cutout.textSide) {
    case 'bottom':
      return 'bottom';
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    default:
      return 'top';
  }
}

/** Available extent + band center on one axis, given the cutout's projected
 *  span (`lo`/`hi`) and the interior bounds (`iLo`/`iHi`). */
function axisBand(zone: Zone, lo: number, hi: number, iLo: number, iHi: number) {
  switch (zone) {
    case 'low':
      return { avail: lo - iLo, center: (iLo + lo) / 2 };
    case 'high':
      return { avail: iHi - hi, center: (hi + iHi) / 2 };
    case 'center': {
      // A label centered on the cutout may extend past the cutout's own span
      // into the surrounding interior, kept symmetric about the center so it
      // never crosses an interior edge. Capping to `hi - lo` starved narrow
      // cutouts: the auto-fit font fell below the legibility floor and the
      // label was silently dropped from both the editor and the engraving
      // (#2583). The label overflowing a neighboring cutout is accepted.
      const center = (lo + hi) / 2;
      return { avail: 2 * Math.min(center - iLo, iHi - center), center };
    }
  }
}

/**
 * Where a cutout's engraved label sits, and how much room it has, for the
 * resolved 9-point anchor (see {@link resolveCutoutTextAnchor}). The eight
 * outer anchors land in the gap between the cutout's rotation-aware AABB and the
 * bin interior; `center` sits over the cutout footprint itself. On the axis a
 * label spans (X for top/bottom, Y for left/right, both for center) the band is
 * not clamped to the cutout's own span — it grows symmetrically into the
 * interior so a narrow cutout can't shrink the label below the legibility floor
 * and drop it (#2583). A `textOffset` then nudges the center freely (and may
 * push it past the band — by design, for fine-tuning and drag).
 *
 * The anchor is interpreted in WORLD coordinates (top = +Y, right = +X, …); the
 * label text reads left-to-right regardless of cutout rotation, so `availW` is
 * always the band's X extent and `availD` its Y extent. Returns `null` when the
 * chosen band has no room (before the offset is applied).
 */
export function cutoutLabelPlacement(
  cutout: Pick<
    Cutout,
    'x' | 'y' | 'width' | 'depth' | 'rotation' | 'textSide' | 'textAnchor' | 'textOffset'
  >,
  innerW: number,
  innerD: number,
  originX = 0,
  originY = 0
): CutoutLabelPlacement | null {
  const zones = ANCHOR_ZONES[resolveCutoutTextAnchor(cutout)];
  const { minX, maxX, minY, maxY } = cutoutWorldAabb(cutout, originX, originY);

  const x = axisBand(zones.h, minX, maxX, originX, originX + innerW);
  const y = axisBand(zones.v, minY, maxY, originY, originY + innerD);
  if (x.avail <= 0 || y.avail <= 0) return null;

  const offset = cutout.textOffset;
  return {
    centerX: x.center + (offset?.x ?? 0),
    centerY: y.center + (offset?.y ?? 0),
    availW: x.avail,
    availD: y.avail,
  };
}
