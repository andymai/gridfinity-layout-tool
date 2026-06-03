/**
 * Pure predicates + types for which cutout property sections/controls apply to
 * a given shape. Kept out of the component files so fast-refresh stays happy
 * (component modules must export only components).
 */

import type { Cutout } from '@/features/bin-designer/types';
import { CLEARANCE_SHAPES, CHAMFER_SHAPES } from '@/features/bin-designer/types';

/** Which insertion-fit field is focused, for the live canvas cue. */
export type FitCue = 'clearance' | 'chamfer' | null;

/** True when a shape exposes any parametric sizing control (sides / presets). */
export function hasShapeControls(shape: Cutout['shape']): boolean {
  return shape === 'polygon' || shape === 'circle';
}

/** True when a shape exposes any insertion-fit control (clearance / chamfer). */
export function hasFitControls(cutout: Pick<Cutout, 'shape' | 'cutDepth'>): boolean {
  const isClearance = CLEARANCE_SHAPES.includes(cutout.shape);
  const isChamfer = CHAMFER_SHAPES.includes(cutout.shape) && cutout.cutDepth - 0.2 > 0;
  return isClearance || isChamfer;
}
