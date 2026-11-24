/**
 * The cradle's arc and the walls it may open, in one place for the worker's
 * tool and channels, the open-side plan and the inspector.
 */

import type { Cutout, CutoutOpenSide } from '@/shared/types/bin';
import { isCradle } from '@/shared/types/bin';

export interface CradleArc {
  /** Radius of the floor's arc (mm). */
  readonly radius: number;
  /**
   * Height above the arc's lowest point where the arc meets the cradle's
   * sides: the full depth for a shallow arc, the radius for a half circle with
   * straight sides above it.
   */
  readonly endZ: number;
}

/**
 * The arc through both top edges of a cradle `width` wide and its lowest point
 * `depth` below them. Deeper than half the width, the arc would bulge past
 * the cradle's sides, so it stops at a half circle and the sides go straight.
 */
export function cradleArc(width: number, depth: number): CradleArc {
  const half = width / 2;
  if (depth >= half) return { radius: half, endZ: half };
  return { radius: (half * half + depth * depth) / (2 * depth), endZ: depth };
}

/**
 * A cutout with its cradle role made consistent: the flag only on a rectangle
 * and only as `true`, and a cradle's corners square, since the arc runs end to
 * end and the editor draws the corners from `cornerRadius`. An unchanged
 * cutout comes back by reference.
 */
export function normalizeCradle(cutout: Cutout): Cutout {
  if (!('cradle' in cutout)) return cutout;
  if (!isCradle(cutout)) {
    const { cradle: _cradle, ...rest } = cutout;
    return rest;
  }
  return cutout.cornerRadius === 0 ? cutout : { ...cutout, cornerRadius: 0 };
}

/** The bin axis a cradle runs along, or null when it is turned off square. */
export function cradleAxis(rotationDeg: number): 'x' | 'y' | null {
  const turned = ((rotationDeg % 180) + 180) % 180;
  if (Math.abs(turned) < 1e-6 || Math.abs(turned - 180) < 1e-6) return 'y';
  if (Math.abs(turned - 90) < 1e-6) return 'x';
  return null;
}

export function cradleOpensSide(
  cutout: Pick<Cutout, 'shape' | 'cradle' | 'rotation'>,
  side: CutoutOpenSide
): boolean {
  if (!isCradle(cutout)) return false;
  const axis = cradleAxis(cutout.rotation);
  return side === 'left' || side === 'right' ? axis === 'x' : axis === 'y';
}
