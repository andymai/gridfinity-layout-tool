/**
 * Predicts whether the wall pattern will actually reach the compartment
 * dividers, so the panel can say so instead of leaving the user with
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
import {
  calculateDividerPieceHeight,
  dividerGrooveDepth,
  dividerSeatZ,
  calculateDividerLength,
  calculateShortDividerLengths,
  calculateShortDividerSpans,
  calculateSlotPositions,
  getEffectiveSlotDimensions,
  getReceptacleDepth,
  resolveCompartmentDividerHeight,
  resolveCrossDividerMode,
  tabEngagement,
} from '@/shared/utils/slotMath';
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
  if (params.base.solid || params.style === 'solid') return 'unavailable';
  if (isPartialMask(params.cellMask)) return 'unavailable';

  const { innerW, innerD, wallHeight } = binDimensions(params);
  if (innerW <= 0 || innerD <= 0) return 'unavailable';

  const { minPatternHeight, shapeRadius } = wallPatternElementMetrics(
    wallPattern.pattern,
    params.height,
    wallPattern.scale ?? DEFAULT_PATTERN_SCALE
  );
  const border = Math.max(CUTOUT_BORDER_WIDTH, shapeRadius);
  // One element plus its two junction margins — the least a divider can carry.
  const minSpan = 2 * border + 2 * shapeRadius;

  const resolved =
    params.style === 'slotted'
      ? resolveSlottedBand(params, innerW, innerD, wallHeight, border)
      : resolveIntegratedBand(params, innerW, innerD, wallHeight, border);
  if (!resolved) return 'unavailable';
  if (resolved.bandHeight < minPatternHeight) return 'none';

  const fitted = resolved.spans.filter((span) => span >= minSpan).length;
  if (fitted === 0) return 'none';
  return fitted < resolved.spans.length ? 'partial' : 'full';
}

interface ResolvedBand {
  readonly bandHeight: number;
  /** Patternable span of each divider, after end margins. */
  readonly spans: number[];
}

/** Band and spans for integrated compartment dividers. */
function resolveIntegratedBand(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  border: number
): ResolvedBand | null {
  // A zero-thickness grid has compartment IDs but no divider walls. Unreachable
  // through the UI, but `migrateParams` spreads a persisted `compartments`
  // object without clamping, so a crafted payload can carry it — and the worker
  // gate (`dividerPatternsApply`) rejects it.
  if (params.compartments.thickness <= 0) return null;
  const spans = dividerSpans(params, innerW, innerD);
  if (spans.length === 0) return null;

  const interiorHeight = computeInteriorHeight(
    wallHeight,
    params.base.stackingLip,
    GRIDFINITY.LIP_SMALL_TAPER
  );
  const dividerHeight = resolveCompartmentDividerHeight(
    params.compartments.dividerHeight,
    interiorHeight
  );
  return {
    bandHeight: dividerHeight - TOP_KEEP_OUT - (params.wallThickness + BOTTOM_SOLID_SKIRT),
    spans: spans.map((span) => span - 2 * border),
  };
}

/**
 * Band and spans for a slotted bin's REMOVABLE pieces.
 *
 * A removable piece is free-standing, so there is no floor slab to clear —
 * only the solid rim at each edge (mirrors `dividerPiecePatterns`). Spans are
 * the printed length minus the tab engagement buried in each wall slot.
 */
function resolveSlottedBand(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  border: number
): ResolvedBand | null {
  const { slotConfig, dividerPieces } = params;
  if (dividerPieces.thickness <= 0) return null;
  if (!slotConfig.x.enabled && !slotConfig.y.enabled) return null;

  const { slotDepth } = getEffectiveSlotDimensions(
    params.wallThickness,
    dividerPieces.thickness,
    dividerPieces.clearance
  );
  const clearance = dividerPieces.clearance;
  const tab = tabEngagement(slotDepth, clearance);
  const height = calculateDividerPieceHeight(
    dividerPieces,
    wallHeight,
    params.base.stackingLip,
    dividerSeatZ(params.wallThickness, dividerGrooveDepth(params))
  );
  const usable = (length: number, endTab: number): number => length - 2 * (endTab + border);

  const spans: number[] = [];
  if (slotConfig.x.enabled) {
    spans.push(usable(calculateDividerLength(innerW, slotDepth, clearance), tab));
  }
  if (slotConfig.y.enabled) {
    spans.push(usable(calculateDividerLength(innerD, slotDepth, clearance), tab));
  }
  spans.push(...insertModeShortSpans(params, innerW, innerD, slotDepth, tab, usable));

  return {
    bandHeight: height - TOP_KEEP_OUT - BOTTOM_SOLID_SKIRT,
    spans,
  };
}

/**
 * Patternable spans of the SHORT per-compartment pieces that insert mode emits
 * alongside the spanning ones.
 *
 * They are far smaller than a spanning piece, so omitting them would let the
 * panel report `full` while those pieces came out solid. Mirrors the piece plan
 * in `dividerBuilder`, using the same shared helpers it builds the lengths with.
 */
function insertModeShortSpans(
  params: BinParams,
  innerW: number,
  innerD: number,
  slotDepth: number,
  wallTab: number,
  usable: (length: number, endTab: number) => number
): number[] {
  const { slotConfig, dividerPieces } = params;
  if (!slotConfig.x.enabled || !slotConfig.y.enabled) return [];
  const { style, longAxis } = resolveCrossDividerMode(slotConfig, dividerPieces.thickness);
  if (style !== 'insert') return [];

  const lipTaper = GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER;
  const edgeInset = params.base.stackingLip ? Math.max(0, lipTaper - params.wallThickness) : 0;
  const longPositions = calculateSlotPositions(
    longAxis === 'y' ? innerW : innerD,
    longAxis === 'y' ? slotConfig.y.pitch : slotConfig.x.pitch,
    edgeInset
  );
  if (longPositions.length === 0) return [];

  const clearance = dividerPieces.clearance;
  const grooveDepth = getReceptacleDepth(dividerPieces.thickness);
  const shortSpanDim = longAxis === 'y' ? innerW : innerD;
  const lengths = calculateShortDividerLengths(
    calculateShortDividerSpans(longPositions, shortSpanDim, dividerPieces.thickness),
    slotDepth,
    grooveDepth,
    clearance
  );

  const receptacleTab = tabEngagement(grooveDepth, clearance);
  const out: number[] = [];
  if (lengths.interior !== null && lengths.interior > 0) {
    out.push(usable(lengths.interior, receptacleTab));
  }
  if (lengths.edge !== null && lengths.edge > 0) {
    out.push(usable(lengths.edge, Math.min(wallTab, receptacleTab)));
  }
  return out;
}
