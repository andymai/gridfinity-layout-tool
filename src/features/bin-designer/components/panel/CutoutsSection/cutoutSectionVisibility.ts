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

/** Why a cutout or group cannot carry a repeat, so the section can say so. */
export type RepeatBlockedReason = 'grouped' | 'path' | 'descendantRepeat';

/**
 * The reason a repeat is refused for this cutout, or null when it is not. The
 * Repeat section renders this instead of disappearing: a control that vanishes
 * without explanation reads as a bug.
 *
 * A grouped member is still refused HERE, in the single-cutout inspector,
 * because a repeat on a group belongs to the group: it is offered on the whole
 * selection instead, which is what clicking any member gives you. Reaching one
 * member on its own through the shape list is the only way to land here.
 */
export function repeatBlockedReason(
  cutout: Pick<Cutout, 'shape' | 'groupId'>
): RepeatBlockedReason | null {
  if (cutout.shape === 'path') return 'path';
  if (cutout.groupId !== null) return 'grouped';
  return null;
}

/** True when a cutout carries knife measurements (the Knife section's gate). */
export function hasKnifeControls(cutout: Pick<Cutout, 'shape'>): boolean {
  return cutout.shape === 'knifeSlot';
}

/** Inputs for {@link knifeDepthClamp}, all in mm except the height unit. */
export interface KnifeDepthInputs {
  /** Cut depth the knife's heel height asks for. */
  readonly cutDepth: number;
  /** Interior wall height for the current bin height (socket already removed). */
  readonly wallHeight: number;
  /** `height × heightUnitMm` — the whole part, socket included. */
  readonly totalHeight: number;
  /** Global cutout top offset: how far the fill surface sits below the rim. */
  readonly topOffset: number;
  readonly heightUnitMm: number;
}

/** How far a knife slot overshoots the fill surface, and the bin that would hold it. */
export interface KnifeDepthClamp {
  /** Depth the generator can actually cut (the fill surface's height). */
  readonly availableMm: number;
  /** Bin height, in height units, whose fill surface takes the whole slot. */
  readonly neededHeightUnits: number;
}

/**
 * The clamp a knife slot is about to hit, or null when the bin takes it whole.
 *
 * The generator cuts from `wallHeight - topOffset` (`cutoutBuilder`'s
 * `solidSurfaceZ`), so a slot deeper than that silently stops short — the blade
 * sits proud and nothing in the mesh says why. The height needed is derived
 * from the gap between the total height and the wall height rather than from
 * `SOCKET_HEIGHT`, so a flat or tray base (which has no socket to subtract)
 * answers with its own overhead instead of a Gridfinity constant.
 *
 * Null when there is no cutting surface at all: `solidSurfaceZ <= 0` makes the
 * generator drop every cutout, which is a different problem than a deep one.
 */
export function knifeDepthClamp(input: KnifeDepthInputs): KnifeDepthClamp | null {
  const availableMm = input.wallHeight - input.topOffset;
  if (availableMm <= 0) return null;
  if (input.cutDepth <= availableMm) return null;
  const overheadMm = input.totalHeight - input.wallHeight + input.topOffset;
  return {
    availableMm,
    neededHeightUnits: Math.ceil((input.cutDepth + overheadMm) / input.heightUnitMm),
  };
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
