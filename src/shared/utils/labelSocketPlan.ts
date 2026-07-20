/**
 * Socket placement planning for swappable-label tabs (issue #2666).
 *
 * Pure fit math shared by the generation worker (which cuts the sockets) and
 * the bin-designer UI (width pickers, warnings, mode disabledReason) so the
 * two can never disagree about which plate fits which compartment.
 *
 * Compartments are enforced rectangles, so a label-tab group at a
 * compartment's back/front edge always spans exactly the compartment's
 * column range — the available width below mirrors the grouping +
 * divider-deduction math in `labelTabBuilder.ts` in closed form.
 */

import type { CompartmentConfig } from '@/shared/types/bin';
import { getCompartmentBounds } from '@/shared/types/bin';
import {
  isLabelPlateWidthU,
  largestFittingPlateWidthU,
  labelSocketOuterWidthMm,
  LABEL_PLATE_WIDTHS_U,
} from '@/shared/constants/labelPlates';
import type { LabelPlateWidthU } from '@/shared/constants/labelPlates';

export interface LabelSocketCompartmentPlan {
  readonly compartmentId: number;
  /** Tab span for this compartment in mm (divider halves deducted). */
  readonly availableWidthMm: number;
  /** Standard widths whose socket fits this compartment's tab. */
  readonly fittingWidthsU: readonly LabelPlateWidthU[];
  /** Largest fitting width (the auto choice), or null when none fit. */
  readonly autoWidthU: LabelPlateWidthU | null;
  /** Auto choice unless a valid per-compartment override is set. */
  readonly plateWidthU: LabelPlateWidthU | null;
}

export interface LabelSocketPlan {
  readonly compartments: readonly LabelSocketCompartmentPlan[];
  /**
   * When NO compartment can host a plate, fall back to one socket on a
   * single tab spanning the full bin interior at the outer wall(s). Null
   * when per-compartment sockets exist or when even spanning doesn't fit.
   */
  readonly spanningWidthU: LabelPlateWidthU | null;
  /** False when nothing fits anywhere — the UI disables socket mode. */
  readonly anyFits: boolean;
}

/** One printable plate derived from a socket-mode design. */
export interface LabelPlatePlanEntry {
  /** Compartment the plate labels, or null for the bin-spanning socket. */
  readonly compartmentId: number | null;
  readonly widthU: LabelPlateWidthU;
  readonly text: string;
}

/**
 * Enumerate the plates a socket-mode design needs: one per socketed
 * compartment carrying its `compartmentTexts` entry (or the spanning
 * fallback's single plate carrying `fallbackText`). Shares `planLabelSockets`
 * so the plate set can never disagree with the cut sockets.
 */
export function planLabelPlates(
  compartments: CompartmentConfig,
  innerWmm: number,
  clearanceMm: number,
  fallbackText: string
): LabelPlatePlanEntry[] {
  const plan = planLabelSockets(compartments, innerWmm, clearanceMm);
  if (plan.spanningWidthU !== null) {
    return [{ compartmentId: null, widthU: plan.spanningWidthU, text: fallbackText.trim() }];
  }
  const texts = compartments.compartmentTexts ?? [];
  return plan.compartments
    .filter((p) => p.plateWidthU !== null)
    .map((p) => ({
      compartmentId: p.compartmentId,
      widthU: p.plateWidthU as LabelPlateWidthU,
      text: (texts[p.compartmentId] ?? '').trim(),
    }));
}

export function planLabelSockets(
  compartments: CompartmentConfig,
  innerWmm: number,
  clearanceMm: number
): LabelSocketPlan {
  const { cols, rows, cells, thickness } = compartments;
  const cellW = innerWmm / cols;
  const overrides = compartments.labelPlateWidths;

  const plans: LabelSocketCompartmentPlan[] = [];
  const seen = new Set<number>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = cells[row * cols + col];
      if (seen.has(id)) continue;
      seen.add(id);

      const bounds = getCompartmentBounds(compartments, id);
      if (!bounds) continue;

      const span = (bounds.maxCol - bounds.minCol + 1) * cellW;
      const leftDeduction = bounds.minCol > 0 ? thickness / 2 : 0;
      const rightDeduction = bounds.maxCol < cols - 1 ? thickness / 2 : 0;
      const availableWidthMm = span - leftDeduction - rightDeduction;

      const fittingWidthsU = LABEL_PLATE_WIDTHS_U.filter(
        (u) => labelSocketOuterWidthMm(u, clearanceMm) <= availableWidthMm
      );
      const autoWidthU = fittingWidthsU.at(-1) ?? null;

      const override = overrides?.[id];
      const plateWidthU =
        isLabelPlateWidthU(override) && fittingWidthsU.includes(override) ? override : autoWidthU;

      plans.push({ compartmentId: id, availableWidthMm, fittingWidthsU, autoWidthU, plateWidthU });
    }
  }

  const anyCompartmentFits = plans.some((p) => p.plateWidthU !== null);
  const spanningWidthU = anyCompartmentFits
    ? null
    : largestFittingPlateWidthU(innerWmm, clearanceMm);

  return {
    compartments: plans,
    spanningWidthU,
    anyFits: anyCompartmentFits || spanningWidthU !== null,
  };
}
