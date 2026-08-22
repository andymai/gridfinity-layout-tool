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
import { rotate2d, type PlacedPart } from '@/shared/types/assemblyPlacement';

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

export function snapCoord(v: number, fine: boolean): number {
  const step = fine ? FINE_SNAP_MM : PLACEMENT_SNAP_MM;
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
