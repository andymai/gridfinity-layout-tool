/** Material removed by wall, divider and floor patterns, for print estimates. */

import type { BinParams, WallPatternType } from '@/features/bin-designer/types';
import { isSocketlessBase, isUndersideRelief } from '@/features/bin-designer/types/base';
import { baseWallHeight } from './binDimensions';
import {
  DEFAULT_PATTERN_SCALE,
  DEFAULT_PATTERN_WEB_THICKNESS,
} from '@/features/bin-designer/types';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { computeInteriorHeight } from '@/shared/utils/scoopCalculations';
import { resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';
import { countFilled, isPartialMask } from '@/shared/utils/cellMask';
import { resolveWallPatternSides } from '@/shared/utils/wallPatternSides';
import { FLOOR_PATTERN_BORDER, floorWindowSpan } from '@/shared/generation/floorPatternMetrics';
import {
  stampPatternOpenArea,
  wallPatternElementMetrics,
} from '@/shared/generation/wallPatternMetrics';

/**
 * Approximate open-area fraction of each pattern at neutral scale — the share
 * of the wall face removed by the perforation. Honeycomb keeps its historical
 * 0.907 so existing estimates are unchanged; the sparser patterns remove less.
 *
 * Mirrors the geometry in patterns/* (cross-feature import not allowed). These
 * are estimates; the true fraction shifts slightly with web and keep-outs.
 */
const PATTERN_VOID_FRACTION: Record<WallPatternType, number> = {
  honeycomb: 0.907,
  round: 0.62,
  diamond: 0.72,
  triangle: 0.42,
  slots: 0.48,
  mitsukude: 0.58,
  goma: 0.45,
  asanoha: 0.3,
  sakura: 0.4,
  rindo: 0.45,
  mikado: 0.42,
  'tsumiishi-kikko': 0.45,
};

/**
 * Volume removed by wall-pattern cutouts, for any pattern type.
 *
 * Approximation: pattern-specific open-area fraction of the wall face area,
 * modulated by the scale slider (bolder = more open, web fixed), cut through
 * the full wall thickness.
 */
export function computeWallPatternReduction(
  params: BinParams,
  outerW: number,
  outerD: number,
  totalH: number,
  wallThickness: number,
  bottomH: number
): number {
  // Must match wallPatterns.ts constants (cross-feature import not allowed)
  const HEX_RADIUS = 1.8;
  const WEB_THICKNESS = 0.8;
  const TOP_KEEP_OUT = 1.5;
  const BOTTOM_SOLID_SKIRT = 1.5;

  const wallHeight = totalH - bottomH;
  // wallThickness clears the floor slab; the skirt is the solid band above it
  // that anchors the lowest element row. Mirrors wallPatterns.ts.
  const bottomKeepOut = wallThickness + BOTTOM_SOLID_SKIRT;
  const patternHeight = wallHeight - TOP_KEEP_OUT - bottomKeepOut;
  const minPatternH = Math.sqrt(3) * HEX_RADIUS + WEB_THICKNESS;
  if (patternHeight < minPatternH) return 0;

  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;

  // Patterned wall length: slot-free walls (front/back seat y-axis dividers,
  // left/right seat x-axis) intersected with the per-side selection.
  const sides = resolveWallPatternSides(params.wallPattern);
  const yFree = params.style !== 'slotted' || !params.slotConfig.y.enabled;
  const xFree = params.style !== 'slotted' || !params.slotConfig.x.enabled;
  let patternedWallLength = 0;
  if (yFree) {
    if (sides.front) patternedWallLength += innerW;
    if (sides.back) patternedWallLength += innerW;
  }
  if (xFree) {
    if (sides.left) patternedWallLength += innerD;
    if (sides.right) patternedWallLength += innerD;
  }

  const wallFaceArea = patternedWallLength * patternHeight;

  // Pattern open-area fraction, modulated by scale (0.5 = neutral, factor 1.0)
  // and by the strut width, which the table's fractions assume at 0.8mm.
  const scale = params.wallPattern.scale ?? DEFAULT_PATTERN_SCALE;
  const base = PATTERN_VOID_FRACTION[params.wallPattern.pattern];
  const coverageFraction = Math.min(
    0.95,
    Math.max(0, base * (0.85 + 0.3 * scale) * strutWidthFactor(params, patternHeight))
  );
  const coverage = wallFaceArea * coverageFraction;

  // Material removed per unit area = wall thickness (prisms cut through wall)
  const cutDepth = wallThickness;

  return coverage * cutDepth + dividerPatternReduction(params, innerW, innerD, coverageFraction);
}

/**
 * How much of the default-web open area survives at this design's strut width.
 *
 * Read off the exact stamp model over a metre of band, where the edge margin
 * is noise, so the factor follows the real element spacing. 1 for a kumiko
 * lattice, which has no stamped web, and whenever the design keeps the
 * default; 0 when the wider strut lifts the pattern's minimum band height
 * past this wall, which is the case the worker leaves solid.
 */
function strutWidthFactor(params: BinParams, patternHeight: number): number {
  const { pattern, webThickness } = params.wallPattern;
  if (webThickness === undefined || webThickness === DEFAULT_PATTERN_WEB_THICKNESS) return 1;
  const scale = params.wallPattern.scale ?? DEFAULT_PATTERN_SCALE;
  const { minPatternHeight } = wallPatternElementMetrics(
    pattern,
    params.height,
    scale,
    webThickness
  );
  if (patternHeight < minPatternHeight) return 0;
  const reference = stampPatternOpenArea(pattern, params.height, scale, 1000, patternHeight);
  if (reference <= 0) return 1;
  const actual = stampPatternOpenArea(
    pattern,
    params.height,
    scale,
    1000,
    patternHeight,
    webThickness
  );
  return actual / reference;
}

/**
 * Extra material removed when the pattern is carried through the compartment
 * dividers.
 *
 * Same open-area model as the outer walls, applied to the divider face area
 * and cut through the divider's own thickness. The band is re-fitted to the
 * divider height, matching `planDividerPatterns` — a shortened divider offers
 * proportionally less to perforate.
 */
function dividerPatternReduction(
  params: BinParams,
  innerW: number,
  innerD: number,
  coverageFraction: number
): number {
  // Mirrors the worker's `dividerPatternsApply` gate — subtracting for a bin
  // the generator never patterns would make the estimate disagree with the
  // geometry it is describing.
  if (params.wallPattern.dividers !== true) return 0;
  if (params.style !== 'standard') return 0;
  if (params.base.solid) return 0;
  if (isPartialMask(params.cellMask)) return 0;
  if (params.compartments.thickness <= 0) return 0;

  const dividerHeight = effectiveDividerHeight(params);

  // Mirrors wallPatterns.ts (cross-feature import not allowed).
  const TOP_KEEP_OUT = 1.5;
  const BOTTOM_SOLID_SKIRT = 1.5;
  const bandHeight = dividerHeight - TOP_KEEP_OUT - (params.wallThickness + BOTTOM_SOLID_SKIRT);
  if (bandHeight <= 0) return 0;

  const length = totalDividerLength(params, innerW, innerD);
  if (length <= 0) return 0;

  return length * bandHeight * coverageFraction * params.compartments.thickness;
}

/**
 * Volume removed by the floor pattern.
 *
 * Two cut depths, priced two ways. A SOCKETED integral base is cut straight
 * through feet and slab, so the removal is the open share of the base
 * component (`standardBinSolidComponents.base`, solid-calibrated per #3528 —
 * a foot is not a prism, so a share of the measured term beats an area×depth
 * model). Every SLAB-ONLY base — flat, the underside relief (whose cavity is
 * already open below the slab) and detachable feet (whose body floor sits at
 * Z=0) — only loses `wallThickness` of material under each hole, so the
 * removal is the open area times the slab, priced directly. Booking the
 * full-socket share for those cut a 3x3 estimate roughly in half for a
 * pattern that removes ~4mm³ per cm² of window.
 *
 * Open area is measured from the real element placement rather than a
 * fraction-of-area model: a per-foot window is only ~33mm across, and over a box
 * that small the margin the calculator leaves at every edge is most of the box.
 *
 * Mirrors the worker's `floorPatternApplies` gate so the estimate can't claim a
 * saving the generator never makes.
 */
export function computeFloorPatternReduction(
  params: BinParams,
  wallThickness: number,
  baseVolume: number,
  feetDetach: boolean
): number {
  const floorPattern = params.floorPattern;
  if (floorPattern?.enabled !== true) return 0;
  // `style === 'solid'` alongside `base.solid`: the two are kept in lockstep by
  // a runtime IMPLICATION_RULE, not by `migrateParams`, so a crafted design can
  // carry one without the other.
  if (params.base.solid || params.style === 'solid') return 0;
  // Mirrors `floorPatternApplies`: an interior lite floor has no slab left to
  // perforate, but the underside relief keeps one and still cuts the holes.
  if (params.base.lightweight && !isUndersideRelief(params.base)) return 0;
  if (params.base.spacer) return 0;
  // The generator forces a base-only bin down the solid path, so no floor
  // pattern is ever cut. `base.solid` above does not catch it: IMPLICATION_RULES
  // hold that flag false while the tray keeps style 'standard'.
  if (params.base.tile === true) return 0;
  if (params.width <= 0 || params.depth <= 0) return 0;

  const isFlat = isSocketlessBase(params.base.style);
  const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
  const scale = floorPattern.scale ?? DEFAULT_PATTERN_SCALE;
  const openArea = (w: number, h: number): number =>
    stampPatternOpenArea(floorPattern.pattern, params.height, scale, w, h);

  const outerW = params.width * params.gridUnitMm - GRIDFINITY.TOLERANCE;
  const outerD = params.depth * gridUnitMmY - GRIDFINITY.TOLERANCE;
  // A flat base has no feet to thread the holes through, so the whole cavity
  // floor is one window; a socket bin gets one window per foot — and
  // `halfSockets` quarters every foot, so each cell carries four much smaller
  // windows rather than one big one. Assuming full-cell windows there would
  // over-report the open area several times over, since a window that small
  // fits disproportionately fewer elements.
  const cellUnits = params.base.halfSockets ? 0.5 : 1;
  const windowsPerCell = params.base.halfSockets ? 4 : 1;
  // A custom footprint only grows feet on its filled cells, so only those carry
  // windows. Scaling by the filled fraction tracks that without re-deriving the
  // socket builder's per-cell decomposition here — and it cancels the fact that
  // `baseVolume` counts the full bounding rectangle, leaving the reduction
  // proportional to the cells that actually exist.
  const filledFraction = isPartialMask(params.cellMask)
    ? countFilled(params.cellMask) / (params.cellMask.cols * params.cellMask.rows)
    : 1;
  const totalOpenArea = isFlat
    ? openArea(
        outerW - 2 * wallThickness - 2 * FLOOR_PATTERN_BORDER,
        outerD - 2 * wallThickness - 2 * FLOOR_PATTERN_BORDER
      )
    : params.width *
      params.depth *
      filledFraction *
      windowsPerCell *
      openArea(
        floorWindowSpan(cellUnits, params.gridUnitMm, params.wallThickness),
        floorWindowSpan(cellUnits, gridUnitMmY, params.wallThickness)
      );
  if (totalOpenArea <= 0) return 0;

  const planArea = params.width * params.depth * params.gridUnitMm * gridUnitMmY;
  // See the docstring: slab-only cuts are priced as the direct prism, the
  // socketed full-depth cut as a share of the measured base term.
  const slabOnly = isFlat || isUndersideRelief(params.base) || feetDetach;
  if (slabOnly) {
    return Math.min(totalOpenArea, planArea) * wallThickness;
  }
  return baseVolume * Math.min(1, totalOpenArea / planArea);
}

/**
 * Height an interior divider actually reaches, in mm.
 *
 * Mirrors the generator: dividers rise from the cavity floor to the interior
 * ceiling (the stacking lip's bottom taper eats into it), capped by the
 * user's `dividerHeight`. Shared by the volume and the pattern-reduction terms
 * so shortening the dividers moves both together.
 */
export function effectiveDividerHeight(params: BinParams): number {
  const totalH = params.height * params.heightUnitMm;
  const wallHeight = baseWallHeight(params.base, totalH);
  const interiorHeight = computeInteriorHeight(
    wallHeight,
    params.base.stackingLip,
    GRIDFINITY.LIP_SMALL_TAPER
  );
  return resolveCompartmentDividerHeight(params.compartments.dividerHeight, interiorHeight);
}

/** Summed length of every interior divider wall segment (mm). */
export function totalDividerLength(params: BinParams, innerW: number, innerD: number): number {
  const { cols, rows, cells } = params.compartments;
  if (cols <= 1 && rows <= 1) return 0;
  const cellW = innerW / cols;
  const cellD = innerD / rows;
  let totalLength = 0;

  for (let colBoundary = 1; colBoundary < cols; colBoundary++) {
    for (let row = 0; row < rows; row++) {
      const leftId = cells[row * cols + (colBoundary - 1)];
      const rightId = cells[row * cols + colBoundary];
      if (leftId !== rightId) {
        totalLength += cellD;
      }
    }
  }

  for (let rowBoundary = 1; rowBoundary < rows; rowBoundary++) {
    for (let col = 0; col < cols; col++) {
      const topId = cells[(rowBoundary - 1) * cols + col];
      const bottomId = cells[rowBoundary * cols + col];
      if (topId !== bottomId) {
        totalLength += cellW;
      }
    }
  }

  return totalLength;
}
