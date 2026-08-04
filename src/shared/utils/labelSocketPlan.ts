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

import type {
  CompartmentConfig,
  LabelTabConfig,
  LabelTabFit,
  TabAnchorSide,
} from '@/shared/types/bin';
import {
  compartmentTabEligible,
  compartmentTabXSpan,
  spanningTabEligible,
} from '@/shared/types/bin';
import {
  isLabelPlateIconId,
  isLabelPlateWidthU,
  largestFittingPlateWidthU,
  labelSocketOuterWidthMm,
  LABEL_PLATE_WIDTHS_U,
} from '@/shared/constants/labelPlates';
import type { LabelPlateIconId, LabelPlateWidthU } from '@/shared/constants/labelPlates';

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

interface LabelPlatePlanBase {
  /** Wall the socket this plate clicks into hangs from. */
  readonly anchor: TabAnchorSide;
  readonly widthU: LabelPlateWidthU;
  readonly text: string;
  /** Hardware icon beside the text, from `compartments.labelIcons`. */
  readonly icon?: LabelPlateIconId;
}

/**
 * One printable plate derived from a socket-mode design, discriminated by what
 * it labels: a single compartment, one full-width row (`label.span`), or the
 * whole bin (the spanning-socket fallback, whose caption the caller supplies).
 */
export type LabelPlatePlanEntry =
  | (LabelPlatePlanBase & { readonly scope: 'compartment'; readonly compartmentId: number })
  | (LabelPlatePlanBase & { readonly scope: 'row'; readonly row: number })
  | (LabelPlatePlanBase & { readonly scope: 'bin' });

export interface LabelPlatePlanInput {
  readonly compartments: CompartmentConfig;
  readonly label: LabelTabConfig;
  /** Bin interior width (mm). */
  readonly innerWmm: number;
  /** Bin interior depth (mm) — what the tab bodies have to fit inside. */
  readonly innerDmm: number;
  readonly clearanceMm: number;
  /** Caption for the bin-spanning plate, which labels no single compartment. */
  readonly fallbackText: string;
}

/**
 * Enumerate the plates a socket-mode design needs: exactly one per socket the
 * worker actually cuts.
 *
 * That is one plate per *surviving tab*, not per compartment — with
 * `label.edges = 'both'` a compartment hosts a tab on each wall and therefore
 * needs two plates, minus the front tabs dropped where the pair would collide
 * (issue #2910). Eligibility runs through the same `compartmentTabEligible` /
 * `spanningTabEligible` predicates the worker gates on, and widths through the
 * same `planLabelSockets` fit math, so a planned plate always has a socket to
 * click into and every cut socket gets a plate.
 */
export function planLabelPlates(input: LabelPlatePlanInput): LabelPlatePlanEntry[] {
  const { compartments, label, innerWmm, innerDmm, clearanceMm, fallbackText } = input;

  const edges = label.edges ?? 'back';
  const anchors: TabAnchorSide[] = [];
  if (edges === 'back' || edges === 'both') anchors.push('back');
  if (edges === 'front' || edges === 'both') anchors.push('front');

  const plan = planLabelSockets(compartments, innerWmm, clearanceMm);
  const fitAt = (cellD: number): LabelTabFit => ({
    tabDepth: label.depth,
    inset: label.inset ?? 0,
    cellD,
    bothEdges: edges === 'both',
  });

  // Bin-spanning fallback: the worker models the whole interior as one
  // synthetic 1x1 compartment, so eligibility is measured against the full
  // inner depth and the grid carries no divider overrides to tilt an anchor.
  if (plan.spanningWidthU !== null) {
    const widthU = plan.spanningWidthU;
    const synthetic: CompartmentConfig = {
      cols: 1,
      rows: 1,
      thickness: compartments.thickness,
      cells: [0],
    };
    const fit = fitAt(innerDmm);
    return anchors
      .filter((anchor) => compartmentTabEligible(synthetic, 0, anchor, fit))
      .map((anchor) => ({ scope: 'bin' as const, anchor, widthU, text: fallbackText.trim() }));
  }

  const cellD = innerDmm / compartments.rows;

  // Full-width mode (#2897): one bin-wide plate per row that hosts a spanning
  // tab, captioned from `label.rowTexts`. All rows share the bin-wide pocket,
  // so the per-compartment widths above don't describe this layout.
  if (label.span === true) {
    const widthU =
      planLabelSockets(
        { cols: 1, rows: 1, thickness: compartments.thickness, cells: [0] },
        innerWmm,
        clearanceMm
      ).compartments[0]?.plateWidthU ?? null;
    if (widthU === null) return [];

    const fit = fitAt(cellD);
    const plates: LabelPlatePlanEntry[] = [];
    for (let row = 0; row < compartments.rows; row++) {
      for (const anchor of anchors) {
        if (!spanningTabEligible(compartments, row, anchor, fit)) continue;
        plates.push({
          scope: 'row',
          row,
          anchor,
          widthU,
          text: (label.rowTexts?.[row] ?? '').trim(),
        });
      }
    }
    return plates;
  }

  const texts = compartments.compartmentTexts ?? [];
  const icons = compartments.labelIcons ?? [];
  const fit = fitAt(cellD);

  const plates: LabelPlatePlanEntry[] = [];
  for (const p of plan.compartments) {
    const widthU = p.plateWidthU;
    if (widthU === null) continue;
    const icon = icons[p.compartmentId];
    for (const anchor of anchors) {
      if (!compartmentTabEligible(compartments, p.compartmentId, anchor, fit)) continue;
      plates.push({
        scope: 'compartment',
        compartmentId: p.compartmentId,
        anchor,
        widthU,
        text: (texts[p.compartmentId] ?? '').trim(),
        ...(isLabelPlateIconId(icon) ? { icon } : {}),
      });
    }
  }
  return plates;
}

export function planLabelSockets(
  compartments: CompartmentConfig,
  innerWmm: number,
  clearanceMm: number
): LabelSocketPlan {
  const { cols, rows, cells } = compartments;
  const overrides = compartments.labelPlateWidths;

  const plans: LabelSocketCompartmentPlan[] = [];
  const seen = new Set<number>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = cells[row * cols + col];
      if (seen.has(id)) continue;
      seen.add(id);

      const span = compartmentTabXSpan(compartments, id, innerWmm);
      if (!span) continue;
      const availableWidthMm = span.right - span.left;

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
