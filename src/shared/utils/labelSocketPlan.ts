/**
 * Socket placement planning for swappable-label tabs.
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

import type { BinParams, CompartmentConfig, LabelTabFit, TabAnchorSide } from '@/shared/types/bin';
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
import { planCutoutSocketsForParams } from '@/shared/utils/cutoutLabelSocketPlan';

/**
 * One plate per socket a shadow board's cutouts get. The caption is the
 * cutout's own label, so a plate always names the thing it sits beside.
 */
function planCutoutPlates(
  params: BinParams,
  innerWmm: number,
  innerDmm: number,
  wallHeightMm: number
): LabelPlatePlanEntry[] {
  const { sockets } = planCutoutSocketsForParams(params, innerWmm, innerDmm, wallHeightMm);
  return sockets.map((socket) => ({
    scope: 'cutout' as const,
    cutoutId: socket.cutoutId,
    widthU: socket.widthU,
    text: socket.text,
    ...(socket.icon !== undefined ? { icon: socket.icon } : {}),
  }));
}

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
  readonly widthU: LabelPlateWidthU;
  readonly text: string;
  /** Hardware icon beside the text. */
  readonly icon?: LabelPlateIconId;
}

/** A plate for a socket hanging off a compartment wall. */
interface WallHungPlate extends LabelPlatePlanBase {
  /** Wall the socket this plate clicks into hangs from. */
  readonly anchor: TabAnchorSide;
}

/**
 * One printable plate derived from a socket-mode design, discriminated by what
 * it labels: a single compartment, one full-width row (`label.span`), the
 * whole bin (the spanning-socket fallback, whose caption the caller supplies),
 * or one cutout on a shadow board.
 */
export type LabelPlatePlanEntry =
  | (WallHungPlate & { readonly scope: 'compartment'; readonly compartmentId: number })
  | (WallHungPlate & { readonly scope: 'row'; readonly row: number })
  | (WallHungPlate & { readonly scope: 'bin' })
  | (LabelPlatePlanBase & { readonly scope: 'cutout'; readonly cutoutId: string });

export interface LabelPlatePlanInput {
  /**
   * The whole design, not its compartments and label config alone: a shadow
   * board's plates come from its CUTOUTS, and a caller handed only the two
   * cavity fields would omit them without ever failing to typecheck.
   */
  readonly params: BinParams;
  /** Bin interior width (mm). */
  readonly innerWmm: number;
  /** Bin interior depth (mm) — what the tab bodies have to fit inside. */
  readonly innerDmm: number;
  /** Interior ceiling height (mm): the plane a board's fill surface hangs from. */
  readonly wallHeightMm: number;
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
 *. Eligibility runs through the same `compartmentTabEligible` /
 * `spanningTabEligible` predicates the worker gates on, and widths through the
 * same `planLabelSockets` fit math, so a planned plate always has a socket to
 * click into and every cut socket gets a plate.
 */
export function planLabelPlates(input: LabelPlatePlanInput): LabelPlatePlanEntry[] {
  const { params, innerWmm, innerDmm, wallHeightMm, clearanceMm, fallbackText } = input;
  const { compartments, label } = params;

  // A shadow board's sockets hang off no wall, so they are planned from the
  // cutouts and the label-tab feature is not even available on one. The gate
  // lives here rather than in each caller: four consumers derive their plate
  // set from this function, and one of them checking `label.enabled` first is
  // how a board exports sockets with no plates to fill them.
  const cutoutPlates = planCutoutPlates(params, innerWmm, innerDmm, wallHeightMm);
  if (cutoutPlates.length > 0) return cutoutPlates;

  if (!label.enabled) return [];
  if ((label.mode ?? 'text') !== 'socket') return [];

  const edges = label.edges ?? 'back';
  const anchors: TabAnchorSide[] = [];
  if (edges === 'back' || edges === 'both') anchors.push('back');
  if (edges === 'front' || edges === 'both') anchors.push('front');

  const plan = planLabelSockets(compartments, innerWmm, clearanceMm, label.width);
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

  // Full-width mode: one bin-wide plate per row that hosts a spanning
  // tab, captioned from `label.rowTexts`. All rows share the bin-wide pocket,
  // so the per-compartment widths above don't describe this layout.
  if (label.span === true) {
    const widthU =
      planLabelSockets(
        { cols: 1, rows: 1, thickness: compartments.thickness, cells: [0] },
        innerWmm,
        clearanceMm,
        label.width
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

/**
 * Plate choice follows the TAB, not the compartment: narrowing the shelf to fit
 * a 1u plate must not leave a 2u plate planned for a pocket that no longer has
 * the room. `widthPercent` is the tab width as a percentage of the compartment
 * span; 100 is the whole span.
 */
export function planLabelSockets(
  compartments: CompartmentConfig,
  innerWmm: number,
  clearanceMm: number,
  widthPercent = 100
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
      const availableWidthMm = ((span.right - span.left) * widthPercent) / 100;

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
    : largestFittingPlateWidthU((innerWmm * widthPercent) / 100, clearanceMm);

  return {
    compartments: plans,
    spanningWidthU,
    anyFits: anyCompartmentFits || spanningWidthU !== null,
  };
}
