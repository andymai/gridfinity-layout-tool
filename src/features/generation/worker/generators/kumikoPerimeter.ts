/** The wall perimeter as a ring of flat and corner slabs, each the frame one kumiko cutter fills. */

import { BOX_CORNER_RADIUS } from './generatorConstants';

export type WallSide = 'front' | 'right' | 'back' | 'left';

export interface FlatSlab {
  readonly kind: 'flat';
  readonly side: WallSide;
  readonly u0: number;
  readonly u1: number;
  /** Rotation about Z mapping slab-local +x to the traversal direction. */
  readonly wallAngleDeg: number;
  /** Wall anchor: inner face midpoint (stamp-pattern convention). */
  readonly anchorX: number;
  readonly anchorY: number;
}

export interface CornerSlab {
  readonly kind: 'corner';
  readonly u0: number;
  readonly u1: number;
  /** Corner axis position. */
  readonly cx: number;
  readonly cy: number;
  /** World angle of the corner's arc start (at u0), radians. */
  readonly thetaStart: number;
  /** The two walls this corner joins — drives clip-box routing. */
  readonly prevSide: WallSide;
  readonly nextSide: WallSide;
}

export type PerimeterSlab = FlatSlab | CornerSlab;

interface PerimeterLayout {
  readonly perimeter: number;
  readonly slabs: readonly PerimeterSlab[];
  /** Outer corner radius (mm). */
  readonly cornerRadius: number;
}

/**
 * Walk the outer perimeter counterclockwise starting at the front-left corner
 * tangent point: front → FR corner → right → BR → back → BL → left → FL.
 */
export function computePerimeterLayout(
  outerW: number,
  outerD: number,
  innerW: number,
  innerD: number,
  cornerRadius: number
): PerimeterLayout {
  const r = cornerRadius;
  const flatW = outerW - 2 * r;
  const flatD = outerD - 2 * r;
  const arc = (Math.PI / 2) * r;

  const slabs: PerimeterSlab[] = [];
  let u = 0;
  const flat = (side: WallSide, len: number, angle: number, ax: number, ay: number): void => {
    slabs.push({
      kind: 'flat',
      side,
      u0: u,
      u1: u + len,
      wallAngleDeg: angle,
      anchorX: ax,
      anchorY: ay,
    });
    u += len;
  };
  const corner = (
    cx: number,
    cy: number,
    thetaStart: number,
    prevSide: WallSide,
    nextSide: WallSide
  ): void => {
    slabs.push({ kind: 'corner', u0: u, u1: u + arc, cx, cy, thetaStart, prevSide, nextSide });
    u += arc;
  };

  flat('front', flatW, 0, 0, -innerD / 2);
  corner(outerW / 2 - r, -outerD / 2 + r, -Math.PI / 2, 'front', 'right');
  flat('right', flatD, 90, innerW / 2, 0);
  corner(outerW / 2 - r, outerD / 2 - r, 0, 'right', 'back');
  flat('back', flatW, 180, 0, innerD / 2);
  corner(-outerW / 2 + r, outerD / 2 - r, Math.PI / 2, 'back', 'left');
  flat('left', flatD, 270, -innerW / 2, 0);
  corner(-outerW / 2 + r, -outerD / 2 + r, Math.PI, 'left', 'front');

  return { perimeter: u, slabs, cornerRadius: r };
}

/**
 * Perimeter the wrapped lattice is quantized against for this bin, or null
 * when the footprint is too small to carry a corner arc.
 *
 * Divider panels resolve their lattice against this SAME perimeter so
 * their triangles come out the exact size the outer walls resolved to —
 * `quantizeColumns` depends only on perimeter and target cell size, so only
 * the band height differs between a wall and a divider.
 */
export function resolveKumikoPerimeter(
  innerW: number,
  innerD: number,
  wallThickness: number
): number | null {
  const outerW = innerW + 2 * wallThickness;
  const outerD = innerD + 2 * wallThickness;
  const cornerRadius = Math.min(BOX_CORNER_RADIUS, Math.min(outerW, outerD) / 2 - 0.1);
  if (cornerRadius <= 0.2) return null;
  return computePerimeterLayout(outerW, outerD, innerW, innerD, cornerRadius).perimeter;
}
