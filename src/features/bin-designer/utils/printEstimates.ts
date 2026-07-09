/**
 * Print estimate calculations for the bin designer.
 *
 * Analytically computes material volume from bin parameters,
 * then derives filament usage and print time estimates.
 *
 * Volume is computed as:
 *   shell + base socket + stacking lip + dividers + label tabs − scoops
 *
 * This avoids expensive mesh-based volume integration.
 */

import type { BinParams, LabelTabSupport } from '@/features/bin-designer/types';
import { GRIDFINITY, STYLE_WALL_THICKNESS } from '@/features/bin-designer/constants/gridfinity';
import {
  compartmentHasTiltedBackWall,
  compartmentHasTiltedFrontWall,
  getCompartmentBounds,
} from '@/features/bin-designer/utils/compartments';
import { isFeatureActive } from '@/shared/constraints';
import {
  PLA_DENSITY,
  FILAMENT_AREA_MM2,
  OVERHEAD_MINUTES,
  MINUTES_PER_METER,
  DEFAULT_PRINT_SETTINGS,
  scalePrintTime,
  standardBinSolidComponents,
  type PrintSettings,
} from '@/shared/printSettings';
import {
  resolveScoopProfile,
  computeLipOffset,
  computeInteriorHeight,
} from '@/shared/utils/scoopCalculations';
export interface PrintEstimate {
  /** Estimated material volume in mm³ */
  readonly volumeMm3: number;
  /** Estimated filament mass in grams */
  readonly gramsFilament: number;
  /** Estimated filament length in meters */
  readonly metersFilament: number;
  /** Estimated print time in minutes */
  readonly printTimeMinutes: number;
  /** Estimated cost in USD */
  readonly costUSD: number;
}
/**
 * Computes print estimates from bin parameters.
 *
 * @param params - Complete bin parameter set
 * @param printSettings - User print settings (cost, layer height, infill)
 * @returns Print estimates including volume, mass, filament length, time, and cost
 */
export function estimatePrint(
  params: BinParams,
  printSettings: PrintSettings = DEFAULT_PRINT_SETTINGS
): PrintEstimate {
  const volumeMm3 = computeBinVolume(params);
  const volumeCm3 = volumeMm3 / 1000; // mm³ → cm³
  const gramsFilament = volumeCm3 * PLA_DENSITY;
  const metersFilament = volumeMm3 / FILAMENT_AREA_MM2 / 1000; // mm³ → mm length → m

  // Scale only the extrusion portion; overhead (bed heat, etc.) is constant
  const baseExtrusionMinutes = metersFilament * MINUTES_PER_METER;
  const printTimeMinutes = OVERHEAD_MINUTES + scalePrintTime(baseExtrusionMinutes, printSettings);

  const costUSD = (gramsFilament / 1000) * printSettings.filamentCostPerKg; // g → kg × $/kg

  return {
    volumeMm3: Math.round(volumeMm3),
    gramsFilament: Math.round(gramsFilament * 10) / 10,
    metersFilament: Math.round(metersFilament * 100) / 100,
    printTimeMinutes: Math.round(printTimeMinutes),
    costUSD: Math.round(costUSD * 100) / 100,
  };
}

/**
 * Formats print time as human-readable string.
 */
export function formatPrintTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Formats filament length for display.
 */
export function formatFilament(meters: number): string {
  if (meters < 1) return `${Math.round(meters * 100)}cm`;
  return `${meters.toFixed(1)}m`;
}
/**
 * Computes total material volume analytically from bin parameters.
 *
 * The standard bin shell (perimeter walls + floor + base socket feet +
 * stacking lip) reuses the shared, OCCT-calibrated estimator
 * (`standardBinSolidComponents`) so the designer and print-export agree on the
 * base geometry. Feature deltas are layered on top:
 *   + Divider walls
 *   + Label tabs
 *   − Scoops (removes material)
 *   − Honeycomb wall reduction
 *
 * (The previous local hollow-box model treated the bottom 7mm as a solid slab,
 * over-reporting standard bins by ~3–6×.)
 */
function computeBinVolume(params: BinParams): number {
  const wallThickness = STYLE_WALL_THICKNESS[params.style] ?? GRIDFINITY.WALL_THICKNESS;
  // Y axis uses gridUnitMmY when set (non-square grid); otherwise it equals the
  // X pitch, so square bins are unchanged.
  const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
  // Outer dimensions in mm
  const outerW = params.width * params.gridUnitMm - GRIDFINITY.TOLERANCE;
  const outerD = params.depth * gridUnitMmY - GRIDFINITY.TOLERANCE;
  // Height units INCLUDE the base (first unit = base, no cavity)
  const totalH = params.height * params.heightUnitMm;

  // Base height (7mm dead space: profile + bridge + floor, no cavity here)
  const bottomH = GRIDFINITY.BASE_HEIGHT;

  // Standard bin shell: walls + floor + base feet (+ lip when enabled),
  // from the shared OCCT-calibrated model.
  const shell = standardBinSolidComponents(
    params.width,
    params.depth,
    params.height,
    params.gridUnitMm,
    params.heightUnitMm,
    gridUnitMmY
  );
  let volume = shell.walls + shell.base + (params.base.stackingLip ? shell.lip : 0);

  // Divider volumes (standard style only — slotted/solid don't use interior dividers)
  if (params.style === 'standard') {
    volume += computeDividerVolume(params, outerW, outerD, totalH, wallThickness, bottomH);
  }

  // Label tabs (shelf + support structure)
  if (isFeatureActive(params, 'label')) {
    volume += computeLabelTabVolume(params, outerW, outerD, wallThickness);
  }

  // Scoops (remove material from compartment front walls)
  if (isFeatureActive(params, 'scoop')) {
    volume -= computeScoopVolume(params, outerW, outerD, wallThickness);
  }

  // Wall pattern: honeycomb wall reduction
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- pattern type may expand beyond 'honeycomb'
  if (params.wallPattern.enabled && params.wallPattern.pattern === 'honeycomb') {
    volume -= computeHoneycombWallReduction(params, outerW, outerD, totalH, wallThickness, bottomH);
  }

  // Exterior-wall collar (issue #2500): a walled ring raised above the nominal
  // body — perimeter wall material only, no floor/interior. Ring cross-section
  // (outer area − inner area) × collar height.
  const collarMm = Math.max(0, params.extraWallHeightMm ?? 0);
  if (collarMm > 0) {
    const innerW = Math.max(0, outerW - 2 * wallThickness);
    const innerD = Math.max(0, outerD - 2 * wallThickness);
    volume += (outerW * outerD - innerW * innerD) * collarMm;
  }

  // Volume cannot be negative (scoops on tiny bins)
  return Math.max(0, volume);
}
/**
 * Volume of all divider walls inside the cavity.
 */
function computeDividerVolume(
  params: BinParams,
  outerW: number,
  outerD: number,
  totalH: number,
  wallThickness: number,
  bottomH: number
): number {
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const dividerH = totalH - bottomH;
  const { cols, rows, thickness, cells } = params.compartments;

  if (cols <= 1 && rows <= 1) return 0;

  const cellW = innerW / cols;
  const cellD = innerD / rows;
  let totalLength = 0;

  // Count vertical wall segment lengths
  for (let colBoundary = 1; colBoundary < cols; colBoundary++) {
    for (let row = 0; row < rows; row++) {
      const leftId = cells[row * cols + (colBoundary - 1)];
      const rightId = cells[row * cols + colBoundary];
      if (leftId !== rightId) {
        totalLength += cellD;
      }
    }
  }

  // Count horizontal wall segment lengths
  for (let rowBoundary = 1; rowBoundary < rows; rowBoundary++) {
    for (let col = 0; col < cols; col++) {
      const topId = cells[(rowBoundary - 1) * cols + col];
      const bottomId = cells[rowBoundary * cols + col];
      if (topId !== bottomId) {
        totalLength += cellW;
      }
    }
  }

  // Volume = total wall length × thickness × height
  return totalLength * thickness * dividerH;
}
/** Builder constant: max unsupported shelf span between bracket gussets. */
const BRACKET_GUSSET_SPACING_MM = 10;

interface LabelTabGeom {
  readonly tabDepth: number;
  readonly gussetLeg: number;
  readonly wallThickness: number;
  readonly dividerThickness: number;
  readonly widthPercent: number;
  readonly inset: number;
  readonly support: LabelTabSupport;
}

/**
 * Volume of label tabs, mirroring `labelTabBuilder.buildTabsAtRow`'s
 * grouping and skip conditions (tilted anchor wall, depth+inset overrun,
 * `edges='both'` collisions) so the estimate tracks what the builder
 * actually generates.
 */
function computeLabelTabVolume(
  params: BinParams,
  outerW: number,
  outerD: number,
  wallThickness: number
): number {
  const { cols, rows, thickness } = params.compartments;
  const { depth: tabDepth, width: widthPercent, support } = params.label;
  const inset = params.label.inset ?? 0;
  const edges = params.label.edges ?? 'back';

  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const cellW = innerW / cols;
  const cellD = innerD / rows;

  // Mirrors the bridge guard in `buildLabelTabsInScope`.
  if (tabDepth >= innerD) return 0;

  // `gussetLeg` clamps at 0 so a tabDepth ≤ wallThickness yields shelf-only
  // volume (no support), matching the builder's guard on degenerate geometry.
  const geom: LabelTabGeom = {
    tabDepth,
    gussetLeg: Math.max(0, tabDepth - wallThickness),
    wallThickness,
    dividerThickness: thickness,
    widthPercent,
    inset,
    support,
  };

  const includeBack = edges === 'back' || edges === 'both';
  const includeFront = edges === 'front' || edges === 'both';
  const collidingFrontIds =
    edges === 'both' ? findCollidingFrontIds(params, cellD, tabDepth, inset) : null;

  let volume = 0;
  for (let row = 0; row < rows; row++) {
    if (includeBack) {
      volume += sumTabVolumesAtRow(params, row, 'back', cellW, cellD, geom, null);
    }
    if (includeFront) {
      volume += sumTabVolumesAtRow(params, row, 'front', cellW, cellD, geom, collidingFrontIds);
    }
  }
  return volume;
}

/**
 * Per-tab volume as a function of shelf width. Support depends on style:
 *   - `solid` / `fillet`: triangular prism extruded the full shelf width.
 *     Fillet has a concave profile but the over-estimate is small.
 *   - `bracket`: ~`ceil(tabWidth / BRACKET_GUSSET_SPACING_MM)` gussets,
 *     each extruded by the divider thickness (within ±1 of the builder).
 */
function tabContribution(geom: LabelTabGeom, tabWidth: number): number {
  if (tabWidth <= 0) return 0;
  const shelf = geom.tabDepth * tabWidth * geom.wallThickness;
  if (geom.gussetLeg <= 0) return shelf;
  const triangleArea = 0.5 * geom.tabDepth * geom.gussetLeg;
  const support =
    geom.support === 'bracket'
      ? Math.max(1, Math.ceil(tabWidth / BRACKET_GUSSET_SPACING_MM)) *
        triangleArea *
        geom.dividerThickness
      : triangleArea * tabWidth;
  return shelf + support;
}

/**
 * Sum tab volumes for one row + anchor edge. Mirrors the grouping and
 * skip logic of `labelTabBuilder.buildTabsAtRow`, including the
 * `thickness/2` boundary deduction at real divider walls.
 */
function sumTabVolumesAtRow(
  params: BinParams,
  row: number,
  anchor: 'back' | 'front',
  cellW: number,
  cellD: number,
  geom: LabelTabGeom,
  collidingFrontIds: Set<number> | null
): number {
  const { cols, rows, cells, thickness } = params.compartments;
  const isOuterEdgeRow = anchor === 'back' ? row === rows - 1 : row === 0;
  const neighborRowOffset = anchor === 'back' ? 1 : -1;
  const hasTiltedAnchorWall =
    anchor === 'back' ? compartmentHasTiltedBackWall : compartmentHasTiltedFrontWall;

  const cellAt = (c: number): number => cells[row * cols + c];
  const anchorsTab = (c: number): boolean =>
    isOuterEdgeRow || cellAt(c) !== cells[(row + neighborRowOffset) * cols + c];

  let volume = 0;
  let col = 0;

  while (col < cols) {
    const cellId = cellAt(col);
    if (!anchorsTab(col)) {
      col++;
      continue;
    }
    if (hasTiltedAnchorWall(params.compartments, cellId)) {
      col++;
      continue;
    }
    if (anchor === 'front' && collidingFrontIds?.has(cellId)) {
      col++;
      continue;
    }

    const bounds = getCompartmentBounds(params.compartments, cellId);
    if (bounds) {
      const compartmentDepth = (bounds.maxRow - bounds.minRow + 1) * cellD;
      if (geom.tabDepth + geom.inset > compartmentDepth) {
        col++;
        continue;
      }
    }

    let groupEnd = col + 1;
    while (groupEnd < cols && cellAt(groupEnd) === cellId && anchorsTab(groupEnd)) {
      groupEnd++;
    }

    const groupCols = groupEnd - col;
    const groupMinCol = col;
    const groupMaxCol = groupEnd - 1;

    // Deduct half the divider thickness on either side that borders an
    // actual divider wall (a different compartment). Outer bin walls don't
    // deduct — the cellW already starts inside the bin wall.
    const leftDeduction = groupMinCol > 0 && cellAt(groupMinCol - 1) !== cellId ? thickness / 2 : 0;
    const rightDeduction =
      groupMaxCol < cols - 1 && cellAt(groupMaxCol + 1) !== cellId ? thickness / 2 : 0;
    const availableWidth = groupCols * cellW - leftDeduction - rightDeduction;
    const tabWidth = (availableWidth * geom.widthPercent) / 100;

    volume += tabContribution(geom, tabWidth);
    col = groupEnd;
  }

  return volume;
}

/**
 * For `edges='both'`, identify compartments whose back+front tab pair would
 * collide so the front tab is dropped from the estimate. Mirror of
 * `labelTabBuilder.findCollidingFrontCompartments`.
 */
function findCollidingFrontIds(
  params: BinParams,
  cellD: number,
  tabDepth: number,
  inset: number
): Set<number> {
  const { cols, rows, cells } = params.compartments;
  const colliding = new Set<number>();
  const visited = new Set<number>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellId = cells[row * cols + col];
      if (visited.has(cellId)) continue;
      visited.add(cellId);

      const bounds = getCompartmentBounds(params.compartments, cellId);
      if (!bounds) continue;

      const hasFrontAnchor =
        bounds.minRow === 0 || cells[(bounds.minRow - 1) * cols + bounds.minCol] !== cellId;
      const hasBackAnchor =
        bounds.maxRow === rows - 1 || cells[(bounds.maxRow + 1) * cols + bounds.minCol] !== cellId;
      if (!hasBackAnchor || !hasFrontAnchor) continue;

      const compartmentDepth = (bounds.maxRow - bounds.minRow + 1) * cellD;
      if (2 * tabDepth + 2 * inset > compartmentDepth) {
        colliding.add(cellId);
      }
    }
  }

  return colliding;
}

/**
 * Volume removed by scoop ramp (negative contribution).
 *
 * Each scoop's cross-section is a concave quarter-ellipse (curved) or a right
 * triangle (straight), extruded across the compartment width.
 */
function computeScoopVolume(
  params: BinParams,
  outerW: number,
  outerD: number,
  wallThickness: number
): number {
  const { rows, cols } = params.compartments;

  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const colWidth = innerW / cols;
  const rowDepth = innerD / rows;

  const hasLip = params.base.stackingLip;
  const isFlat = params.base.style === 'flat';
  const totalH = params.height * params.heightUnitMm;
  const wallHeight = isFlat ? totalH : totalH - GRIDFINITY.SOCKET_HEIGHT;
  const interiorHeight = computeInteriorHeight(wallHeight, hasLip, GRIDFINITY.LIP_SMALL_TAPER);
  const lipTaperWidth = GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER;

  // Use representative compartment (single-row bins are front row, multi-row are not)
  const isRepresentativeMinRow = rows === 1;
  const lipOffset = computeLipOffset(hasLip, isRepresentativeMinRow, lipTaperWidth, wallThickness);
  const profile = resolveScoopProfile(
    params.scoop,
    colWidth,
    rowDepth,
    isRepresentativeMinRow,
    hasLip,
    wallHeight,
    interiorHeight,
    lipOffset
  );
  if (!profile) return 0;

  const numScoops = cols * rows;

  // Cross-section area × width. Curved: quarter-ellipse (π/4 × run × height);
  // straight: right triangle (½ × run × height).
  const area =
    profile.style === 'curved'
      ? (Math.PI / 4) * profile.run * profile.height
      : 0.5 * profile.run * profile.height;
  const volumePerScoop = area * colWidth;

  return numScoops * volumePerScoop;
}
/**
 * Volume removed by honeycomb wall cutouts.
 *
 * Approximation: hex grid packing density ~90.7% of the wall face area,
 * cut to a fraction of wall thickness (pocketed) or full thickness (perforated).
 */
function computeHoneycombWallReduction(
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
  // that anchors the lowest hex row (#2317). Mirrors wallPatterns.ts.
  const bottomKeepOut = wallThickness + BOTTOM_SOLID_SKIRT;
  const patternHeight = wallHeight - TOP_KEEP_OUT - bottomKeepOut;
  const minPatternH = Math.sqrt(3) * HEX_RADIUS + WEB_THICKNESS;
  if (patternHeight < minPatternH) return 0;

  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;

  // Compute actual slot-free wall length based on which axes have slots
  let slotFreeWallLength = 0;
  if (params.style !== 'slotted' || !params.slotConfig.y.enabled) {
    slotFreeWallLength += 2 * innerW; // front + back
  }
  if (params.style !== 'slotted' || !params.slotConfig.x.enabled) {
    slotFreeWallLength += 2 * innerD; // left + right
  }
  if (slotFreeWallLength === 0) return 0;

  const wallFaceArea = slotFreeWallLength * patternHeight;

  // Hex packing coverage ~90.7% (theoretical max; actual is lower due to web + keep-outs)
  const hexCoverage = wallFaceArea * 0.907;

  // Material removed per unit area = wall thickness (hex prisms cut through wall)
  const cutDepth = wallThickness;

  return hexCoverage * cutDepth;
}
export interface WallPatternSavings {
  readonly savingsPercent: number;
  readonly patternEstimate: PrintEstimate;
  readonly standardEstimate: PrintEstimate;
}

/**
 * Compare wall-pattern-enabled vs standard bin to calculate material savings.
 */
export function calculateWallPatternSavings(
  params: BinParams,
  printSettings: PrintSettings = DEFAULT_PRINT_SETTINGS
): WallPatternSavings {
  const patternEstimate = estimatePrint(params, printSettings);

  // Compute standard estimate with wall pattern disabled
  const standardParams: BinParams = {
    ...params,
    wallPattern: { enabled: false, pattern: 'honeycomb' },
  };
  const standardEstimate = estimatePrint(standardParams, printSettings);

  const savingsPercent =
    standardEstimate.volumeMm3 > 0
      ? Math.round(
          ((standardEstimate.volumeMm3 - patternEstimate.volumeMm3) / standardEstimate.volumeMm3) *
            100
        )
      : 0;

  return { savingsPercent, patternEstimate, standardEstimate };
}
