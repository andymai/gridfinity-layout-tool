/**
 * "What will this cost me to print" for a community design.
 *
 * Lives in shared rather than in the community slice because the estimator it
 * wraps is bin-designer internal, and features cannot import across slices.
 * shared/ is the sanctioned bridge (see `shared/items/bin/descriptor.ts` for
 * the same pattern).
 *
 * The central rule here: **observed beats estimated, and the difference is
 * never hidden.** A model estimate and twelve people's actual print times are
 * different kinds of claim, so they carry a `source` the UI must render
 * differently. Presenting an estimate as though it were measured is the exact
 * failure this feature exists to avoid.
 */

import { estimatePrint } from '@/features/bin-designer/utils/printEstimates';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';
import type { PrintSettings } from '@/shared/printSettings';
import type { CommunityDesignMetrics } from '@/shared/types/community';
import type { CommunityPrintSummary } from '@/shared/types/communityPrint';

export interface CommunityPrintEstimate {
  readonly grams: number;
  readonly meters: number;
  readonly minutes: number;
}

export function estimateCommunityPrint(
  params: BinParams,
  settings: PrintSettings = DEFAULT_PRINT_SETTINGS
): CommunityPrintEstimate {
  const estimate = estimatePrint(params, settings);
  return {
    grams: estimate.gramsFilament,
    meters: estimate.metersFilament,
    minutes: estimate.printTimeMinutes,
  };
}

/**
 * How a displayed figure was arrived at. `observed` carries the sample size,
 * because "about 2h, from 12 prints" and "about 2h, from 1 print" are not
 * equally trustworthy and the reader should be able to tell.
 */
export type PrintCostSource =
  { readonly kind: 'observed'; readonly sampleSize: number } | { readonly kind: 'estimated' };

export interface PrintCostFigure {
  readonly minutes: number | null;
  readonly grams: number | null;
  readonly source: PrintCostSource;
}

/**
 * Minimum reports before observed data displaces the model.
 *
 * One person's print is a data point, not a distribution: they may have
 * printed at 0.3mm on a machine nothing like yours. Two agreeing medians are
 * weak evidence but they are evidence, and by then the model has been checked
 * against reality at least twice.
 */
export const OBSERVED_MIN_SAMPLE = 2;

/**
 * Resolve what to show, preferring real reports over the model.
 *
 * Time and filament resolve independently: reporting filament is optional, so
 * a design can easily have an observed time and an estimated weight. Mixing
 * them is correct, and the UI labels each.
 */
export function resolvePrintCost(
  estimate: CommunityPrintEstimate | null,
  summary: CommunityPrintSummary | null
): { time: PrintCostFigure; filament: PrintCostFigure } {
  const observedCount = summary?.count ?? 0;
  const enough = observedCount >= OBSERVED_MIN_SAMPLE;

  const observedMinutes = enough ? (summary?.medianPrintMinutes ?? null) : null;
  const observedGrams = enough ? (summary?.medianFilamentGrams ?? null) : null;

  return {
    time:
      observedMinutes !== null
        ? {
            minutes: observedMinutes,
            grams: null,
            source: { kind: 'observed', sampleSize: observedCount },
          }
        : { minutes: estimate?.minutes ?? null, grams: null, source: { kind: 'estimated' } },
    filament:
      observedGrams !== null
        ? {
            minutes: null,
            grams: observedGrams,
            source: { kind: 'observed', sampleSize: observedCount },
          }
        : { minutes: null, grams: estimate?.grams ?? null, source: { kind: 'estimated' } },
  };
}

export type BedFit = 'fits' | 'too-large' | 'unknown';

/**
 * Whether the design's footprint fits the viewer's bed.
 *
 * Footprint only: height is a separate constraint with its own setting, and a
 * bin taller than the machine is a far rarer problem than one that is too wide.
 * Rotation is allowed, because every slicer will do it for you.
 */
export function fitsPrintBed(
  metrics: CommunityDesignMetrics,
  bedWidthMm: number,
  bedDepthMm: number
): BedFit {
  if (!Number.isFinite(bedWidthMm) || !Number.isFinite(bedDepthMm)) return 'unknown';
  if (bedWidthMm <= 0 || bedDepthMm <= 0) return 'unknown';
  if (!Number.isFinite(metrics.width) || !Number.isFinite(metrics.depth)) return 'unknown';
  if (metrics.width <= 0 || metrics.depth <= 0) return 'unknown';

  const upright = metrics.width <= bedWidthMm && metrics.depth <= bedDepthMm;
  const rotated = metrics.depth <= bedWidthMm && metrics.width <= bedDepthMm;
  return upright || rotated ? 'fits' : 'too-large';
}
