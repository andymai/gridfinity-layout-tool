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

// Re-exported so the section predicates read from one import, while the
// definition lives beside the placement math the detector also uses.
export { canArray } from '@/shared/utils/cutoutArray';

/** Why a cutout cannot carry a repeat, so the section can say so. */
export type RepeatBlockedReason = 'grouped' | 'path';

/**
 * The reason `canArray` refuses this cutout, or null when it does not. The
 * Repeat section renders this instead of disappearing: a control that vanishes
 * without explanation reads as a bug, and grouping two shapes in order to
 * repeat the pair is a reasonable thing to have tried.
 */
export function repeatBlockedReason(
  cutout: Pick<Cutout, 'shape' | 'groupId'>
): RepeatBlockedReason | null {
  if (cutout.shape === 'path') return 'path';
  if (cutout.groupId !== null) return 'grouped';
  return null;
}

/** True when a shape exposes any insertion-fit control (clearance / chamfer). */
export function hasFitControls(cutout: Pick<Cutout, 'shape' | 'cutDepth'>): boolean {
  const isClearance = CLEARANCE_SHAPES.includes(cutout.shape);
  const isChamfer = CHAMFER_SHAPES.includes(cutout.shape) && cutout.cutDepth - 0.2 > 0;
  return isClearance || isChamfer;
}

/**
 * Compact state line for the collapsed Fit section, e.g. "Clearance +0.2mm"
 * — so the default insertion allowance is legible without expanding. Labels
 * are passed in (already localized) to keep this free of the i18n hook type.
 */
export function formatFitSummary(
  cutout: Pick<Cutout, 'shape' | 'clearance' | 'chamferWidth' | 'cutDepth'>,
  labels: { readonly clearance: string; readonly chamfer: string; readonly none: string }
): string {
  const parts: string[] = [];
  const clearance = CLEARANCE_SHAPES.includes(cutout.shape) ? (cutout.clearance ?? 0) : 0;
  // Clamp to the same cap CutoutFitControls applies, so a chamfer left over from
  // a deeper cut doesn't read larger here than the control (and the worker) use.
  const maxChamfer = Math.max(0, cutout.cutDepth - 0.2);
  const chamfer = CHAMFER_SHAPES.includes(cutout.shape)
    ? Math.min(cutout.chamferWidth ?? 0, maxChamfer)
    : 0;
  if (clearance > 0) parts.push(`${labels.clearance} +${clearance}mm`);
  if (chamfer > 0) parts.push(`${labels.chamfer} ${chamfer}mm`);
  return parts.length > 0 ? parts.join(' · ') : labels.none;
}
