import polygonClipping, { type Ring } from 'polygon-clipping';
import { convexHull } from '@/shared/scanTrace/minAreaRect';
import type { OutlineRing } from '@/shared/utils/cutoutOutline';

export interface WrenchDims {
  readonly lengthMm: number;
  /** Outer width of the open-end head, across the jaws. */
  readonly openWidthMm: number;
  /** Outer diameter of the box-end ring. */
  readonly boxWidthMm: number;
  /** Narrowest width of the handle. */
  readonly shankWidthMm: number;
  /** Tilt of the open jaws off the handle axis. */
  readonly jawAngleDeg: number;
  /**
   * The shortest length the pocket must also hold. Brands differ by up to a
   * fifth at one size, so the open-end well sweeps from this length to
   * `lengthMm` and a wrench of any length between finds its head inside it.
   * Absent means one length.
   */
  readonly minLengthMm?: number;
}

const ARC_SEGMENTS = 48;
/**
 * How far the jaw mouth sits past the nut centre, as a share of the head's
 * radius. The filled head reads as an open end because the mouth cuts the
 * round head flat, square to the tilted jaws.
 */
const MOUTH_RATIO = 0.7;

function circleRing(cx: number, cy: number, r: number): Ring {
  const ring: Ring = [];
  for (let i = 0; i < ARC_SEGMENTS; i++) {
    const a = (i / ARC_SEGMENTS) * Math.PI * 2;
    ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return ring;
}

/** A circle cut flat at `mouth` past its centre, square to `angleRad`. */
function openHeadRing(cx: number, cy: number, r: number, mouth: number, angleRad: number): Ring {
  const ux = Math.cos(angleRad);
  const uy = Math.sin(angleRad);
  const far = r * 4;
  const keep: Ring = [
    [cx + mouth * ux - far * uy, cy + mouth * uy + far * ux],
    [cx + mouth * ux + far * uy, cy + mouth * uy - far * ux],
    [cx - far * ux + far * uy, cy - far * uy - far * ux],
    [cx - far * ux - far * uy, cy - far * uy + far * ux],
  ];
  const cut = polygonClipping.intersection([circleRing(cx, cy, r)], [keep]);
  return cut.length === 1 ? cut[0][0] : circleRing(cx, cy, r);
}

function signedArea(ring: OutlineRing): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/**
 * The top-down outline of a combination wrench as one ring, for a pocket. The
 * gap between the open jaws is filled: a tongue of plastic there would be thin
 * on small sizes and would make the wrench hard to drop in.
 *
 * The ring runs counter-clockwise in the wrench's own frame: the box-end tip at
 * x = 0, the handle along +x, the centreline on y = 0. Null when the
 * dimensions cannot describe a wrench (heads that do not fit the length, a
 * handle wider than a head) or the parts do not join into one ring.
 */
export function combinationWrenchOutline(dims: WrenchDims): OutlineRing | null {
  const { lengthMm: length, openWidthMm, boxWidthMm, shankWidthMm, jawAngleDeg } = dims;
  const shortest = Math.min(length, dims.minLengthMm ?? length);
  if (![length, openWidthMm, boxWidthMm, shankWidthMm, jawAngleDeg].every(Number.isFinite)) {
    return null;
  }
  if (openWidthMm <= 0 || boxWidthMm <= 0 || shankWidthMm <= 0) return null;
  if (shankWidthMm >= Math.min(openWidthMm, boxWidthMm)) return null;
  if (!Number.isFinite(shortest) || shortest <= boxWidthMm + openWidthMm) return null;

  const boxR = boxWidthMm / 2;
  const headR = openWidthMm / 2;
  const tilt = (jawAngleDeg * Math.PI) / 180;
  const box = circleRing(boxR, 0, boxR);
  const shaped = openHeadRing(0, 0, headR, headR * MOUTH_RATIO, tilt);
  const headX = length - Math.max(...shaped.map(([x]) => x));
  const sweep = length - shortest;
  const head: Ring =
    sweep > 0
      ? convexHull(
          shaped.flatMap(([x, y]) => [
            { x: x + headX, y },
            { x: x + headX - sweep, y },
          ])
        ).map(({ x, y }): [number, number] => [x, y])
      : shaped.map(([x, y]) => [x + headX, y]);

  const neckBox = Math.min(shankWidthMm * 1.15, boxWidthMm * 0.8) / 2;
  const neckOpen = Math.min(shankWidthMm * 1.25, openWidthMm * 0.8) / 2;
  const mid = (boxR + headX) / 2;
  // Over a length range each wrench narrows at its own middle, so one taper
  // cannot hold them all: the handle runs straight at the widest neck instead.
  const half = Math.max(neckBox, neckOpen);
  const shank: Ring =
    sweep > 0
      ? [
          [boxR, -half],
          [headX, -half],
          [headX, half],
          [boxR, half],
        ]
      : [
          [boxR, -neckBox],
          [mid, -shankWidthMm / 2],
          [headX, -neckOpen],
          [headX, neckOpen],
          [mid, shankWidthMm / 2],
          [boxR, neckBox],
        ];

  const merged = polygonClipping.union([box], [shank], [head]);
  if (merged.length !== 1 || merged[0].length !== 1) return null;
  const outer = merged[0][0];
  const ring: OutlineRing = outer.slice(0, -1).map(([x, y]): [number, number] => [x, y]);
  if (signedArea(ring) < 0) ring.reverse();
  return ring;
}
