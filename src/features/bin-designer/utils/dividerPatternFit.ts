/**
 * Predicts whether the wall pattern will actually reach the compartment
 * dividers (#2811), so the panel can say so instead of leaving the user with
 * a checkbox that appears to do nothing.
 *
 * Deliberately a conservative mirror of the worker's `planDividerPatterns`,
 * not a reimplementation of it: it evaluates the band rule and each divider's
 * straight-line span, and ignores the feature keep-outs (scoops, label tabs,
 * interior cutouts) that only the geometry layer can resolve. So a `full`
 * result means "nothing structural stops it", and a divider cleared entirely
 * by keep-outs still stays solid silently — the same convention every other
 * pattern feature follows.
 *
 * The band constants below mirror `wallPatterns.ts`; the module boundary
 * forbids importing them, so keep them in lockstep (same rule as
 * `printEstimates.ts`).
 */

import type { BinParams } from '@/features/bin-designer/types';
import { DEFAULT_PATTERN_SCALE } from '@/features/bin-designer/types';
import { binDimensions } from './binDimensions';
import { resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';
import { computeInteriorHeight } from '@/shared/utils/scoopCalculations';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { isPartialMask } from '@/shared/utils/cellMask';
import { wallPatternElementMetrics } from '@/shared/generation/wallPatternMetrics';

/** Keep-out from the divider's top edge (mm) — mirrors `wallPatterns.ts`. */
const TOP_KEEP_OUT = 1.5;

/** Solid skirt above the interior floor (mm) — mirrors `wallPatterns.ts`. */
const BOTTOM_SOLID_SKIRT = 1.5;

/** Solid margin held at each divider junction (mm) — mirrors `wallPatterns.ts`. */
const CUTOUT_BORDER_WIDTH = 1.5;

export type DividerPatternFit =
  /** The option doesn't apply to this bin at all (no dividers, wrong style). */
  | 'unavailable'
  /** Applies, but no divider can carry a single element. */
  | 'none'
  /** Some dividers are too small; the rest carry the pattern. */
  | 'partial'
  /** Every divider can carry the pattern. */
  | 'full';

/** Straight-line lengths of every interior divider segment, in mm. */
function dividerSpans(params: BinParams, innerW: number, innerD: number): number[] {
  const { cols, rows, cells } = params.compartments;
  if (cols <= 1 && rows <= 1) return [];
  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const spans: number[] = [];

  const collectRuns = (count: number, needsWall: (i: number) => boolean, step: number): void => {
    let start: number | null = null;
    for (let i = 0; i < count; i++) {
      if (needsWall(i)) {
        if (start === null) start = i;
      } else if (start !== null) {
        spans.push((i - start) * step);
        start = null;
      }
    }
    if (start !== null) spans.push((count - start) * step);
  };

  for (let col = 1; col < cols; col++) {
    collectRuns(rows, (row) => cells[row * cols + (col - 1)] !== cells[row * cols + col], cellD);
  }
  for (let row = 1; row < rows; row++) {
    collectRuns(cols, (col) => cells[(row - 1) * cols + col] !== cells[row * cols + col], cellW);
  }
  return spans;
}

/** Assess how much of the divider pattern this bin can actually carry. */
export function assessDividerPatternFit(params: BinParams): DividerPatternFit {
  const { wallPattern } = params;
  if (!wallPattern.enabled || wallPattern.dividers !== true) return 'unavailable';
  if (params.style !== 'standard') return 'unavailable';
  if (params.base.solid) return 'unavailable';
  if (isPartialMask(params.cellMask)) return 'unavailable';
  // A zero-thickness grid has compartment IDs but no divider walls. Unreachable
  // through the UI, but `migrateParams` spreads a persisted `compartments`
  // object without clamping, so a crafted payload can carry it — and the worker
  // gate (`dividerPatternsApply`) rejects it.
  if (params.compartments.thickness <= 0) return 'unavailable';

  const { innerW, innerD, wallHeight } = binDimensions(params);
  if (innerW <= 0 || innerD <= 0) return 'unavailable';

  const spans = dividerSpans(params, innerW, innerD);
  if (spans.length === 0) return 'unavailable';

  const interiorHeight = computeInteriorHeight(
    wallHeight,
    params.base.stackingLip,
    GRIDFINITY.LIP_SMALL_TAPER
  );
  const dividerHeight = resolveCompartmentDividerHeight(
    params.compartments.dividerHeight,
    interiorHeight
  );
  const bandHeight = dividerHeight - TOP_KEEP_OUT - (params.wallThickness + BOTTOM_SOLID_SKIRT);

  const { minPatternHeight, shapeRadius } = wallPatternElementMetrics(
    wallPattern.pattern,
    params.height,
    wallPattern.scale ?? DEFAULT_PATTERN_SCALE
  );
  if (bandHeight < minPatternHeight) return 'none';

  const border = Math.max(CUTOUT_BORDER_WIDTH, shapeRadius);
  const minSpan = 2 * border + 2 * shapeRadius;
  const fitted = spans.filter((span) => span >= minSpan).length;
  if (fitted === 0) return 'none';
  return fitted < spans.length ? 'partial' : 'full';
}
