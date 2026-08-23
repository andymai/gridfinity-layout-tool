/**
 * Scene-frame helpers for the Workshop proxy canvas. The placement math
 * itself lives in `@/shared/types/assemblyPlacement` so the worker generator
 * resolves parts with the exact same code.
 */
import type { ItemEnvelope } from '@/shared/types/item';

export {
  resolvePlacedParts,
  partSeatHeight,
  partFootprint,
  rotate2d,
  type PlacedPart,
} from '@/shared/types/assemblyPlacement';
import { partFootprint, rotate2d, type PlacedPart } from '@/shared/types/assemblyPlacement';

export function baseExtentMm(envelope: ItemEnvelope): { w: number; d: number } {
  return {
    w: envelope.width * envelope.gridUnitMm,
    d: envelope.depth * envelope.gridUnitMm,
  };
}

export function storeToScene(v: number, extent: number): number {
  return v - extent / 2;
}

export function sceneToStore(v: number, extent: number): number {
  return v + extent / 2;
}

export const PLACEMENT_SNAP_MM = 3.5;
export const FINE_SNAP_MM = 0.1;
/** Grid pitches the snap widget cycles through. */
export const SNAP_PITCHES_MM = [1, 3.5, 7] as const;

export function snapCoord(v: number, fine: boolean, pitchMm: number = PLACEMENT_SNAP_MM): number {
  const step = fine ? FINE_SNAP_MM : pitchMm;
  return Math.round(v / step) * step;
}

/** Inverse of `worldToParentLocal`. */
export function parentLocalToWorld(
  point: { x: number; y: number },
  parent: PlacedPart | null
): { x: number; y: number } {
  if (!parent) return { x: point.x, y: point.y };
  const rotated = rotate2d(point.x, point.y, parent.rotZDeg);
  return { x: parent.x + rotated.x, y: parent.y + rotated.y };
}

/**
 * Convert a store-frame world point to a transform local to `parent`
 * (null = a root seated on the base floor).
 */
export function worldToParentLocal(
  point: { x: number; y: number },
  parent: PlacedPart | null
): { x: number; y: number } {
  if (!parent) return { x: point.x, y: point.y };
  return rotate2d(point.x - parent.x, point.y - parent.y, -parent.rotZDeg);
}

export const ROTATION_SNAP_DEG = 15;
export const FINE_ROTATION_SNAP_DEG = 1;

/** Snap an angle to the rotation grid and normalize to (-180, 180]. */
export function snapAngleDeg(deg: number, fine: boolean): number {
  const step = fine ? FINE_ROTATION_SNAP_DEG : ROTATION_SNAP_DEG;
  const snapped = Math.round(deg / step) * step;
  const wrapped = (((snapped % 360) + 540) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

export const ALIGN_SNAP_MM = 2;

export interface AlignSnapResult {
  readonly x: number;
  readonly y: number;
  /** Aligned sibling coordinate per axis, null when the grid snap won. */
  readonly guideX: number | null;
  readonly guideY: number | null;
}

/**
 * Placement snap with sibling alignment: an axis within ALIGN_SNAP_MM of a
 * candidate (sibling center, plate center) snaps to it and reports a guide;
 * otherwise the magnetic grid applies. Fine mode (Alt) disables both magnetic
 * pulls, leaving only the 0.1mm fine grid every Workshop gesture nudges on.
 */
export function alignSnap(
  local: { x: number; y: number },
  candidates: { xs: readonly number[]; ys: readonly number[] },
  fine: boolean,
  pitchMm: number = PLACEMENT_SNAP_MM
): AlignSnapResult {
  if (fine) {
    return { x: snapCoord(local.x, true), y: snapCoord(local.y, true), guideX: null, guideY: null };
  }
  const nearest = (value: number, options: readonly number[]): number | null => {
    let best: number | null = null;
    let bestDistance = ALIGN_SNAP_MM;
    for (const option of options) {
      const distance = Math.abs(value - option);
      if (distance <= bestDistance) {
        best = option;
        bestDistance = distance;
      }
    }
    return best;
  };
  const guideX = nearest(local.x, candidates.xs);
  const guideY = nearest(local.y, candidates.ys);
  return {
    x: guideX ?? snapCoord(local.x, false, pitchMm),
    y: guideY ?? snapCoord(local.y, false, pitchMm),
    guideX,
    guideY,
  };
}

const RING_MARGIN_MM = 8;
const RING_MIN_RADIUS_MM = 14;

/** Ring height above the part top — the rotation catch plane must sit on the
 *  same plane or the ray intersection skews the angle against the visible ring. */
export const ROTATION_RING_LIFT_MM = 2;

/** Rotation-gizmo ring radius: clear of the part's footprint, never cramped. */
export function rotationRingRadiusMm(placed: PlacedPart): number {
  const footprint = partFootprint(placed.node);
  return Math.max(RING_MIN_RADIUS_MM, Math.max(footprint.w, footprint.d) / 2 + RING_MARGIN_MM);
}
