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

import type { BinParams } from '@/features/bin-designer/types';
import { GRIDFINITY, STYLE_WALL_THICKNESS } from '@/features/bin-designer/constants/gridfinity';
import { isFeatureActive } from '@/shared/constraints';
import {
  PLA_DENSITY,
  FILAMENT_AREA_MM2,
  OVERHEAD_MINUTES,
  MINUTES_PER_METER,
  DEFAULT_PRINT_SETTINGS,
  scalePrintTime,
  type PrintSettings,
} from '@/shared/printSettings';
import {
  resolveScoopRadius,
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
 * Components:
 * 1. Outer shell (walls + bottom)
 * 2. Base socket (per-cell baseplate interface)
 * 3. Stacking lip (top perimeter profile)
 * 4. Divider walls
 * 5. Corner gussets (solid style)
 * 6. Label tabs (if enabled)
 * 7. Scoops (if enabled, negative — removes material)
 */
function computeBinVolume(params: BinParams): number {
  const wallThickness = STYLE_WALL_THICKNESS[params.style] ?? GRIDFINITY.WALL_THICKNESS;
  // Outer dimensions in mm
  const outerW = params.width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = params.depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  // Height units INCLUDE the base (first unit = base, no cavity)
  const totalH = params.height * GRIDFINITY.HEIGHT_UNIT;

  // Base height (7mm dead space: profile + bridge + floor, no cavity here)
  const bottomH = GRIDFINITY.BASE_HEIGHT;

  let volume = 0;

  // Shell volume (outer walls + bottom)
  volume += computeHollowBoxVolume(outerW, outerD, totalH, wallThickness, bottomH);

  // Base socket (per grid cell, tapered profile that slides onto baseplate)
  volume += computeBaseSocketVolume(params.width, params.depth);

  // Stacking lip (sits on top of bin body)
  if (params.base.stackingLip) {
    volume += computeStackingLipVolume(outerW, outerD);
  }

  // Divider volumes (standard style only — slotted/solid don't use interior dividers)
  if (params.style === 'standard') {
    volume += computeDividerVolume(params, outerW, outerD, totalH, wallThickness, bottomH);
  }

  // Label tabs (shelf + support structure)
  if (isFeatureActive(params, 'label')) {
    volume += computeLabelTabVolume(params, outerW, wallThickness);
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

  // Volume cannot be negative (scoops on tiny bins)
  return Math.max(0, volume);
}
/**
 * Volume of a hollow box (outer - inner cavity).
 */
function computeHollowBoxVolume(
  w: number,
  d: number,
  h: number,
  wall: number,
  bottomH: number
): number {
  const outerVol = w * d * h;
  const innerW = w - 2 * wall;
  const innerD = d - 2 * wall;
  const innerH = h - bottomH;

  if (innerW <= 0 || innerD <= 0 || innerH <= 0) {
    return outerVol; // Solid block (walls too thick)
  }

  return outerVol - innerW * innerD * innerH;
}

/**
 * Volume of base socket structure (per-cell interface to baseplate).
 *
 * Each full grid cell has a tapered socket (~5mm deep). The socket is a
 * thin-walled shell approximately 3.5mm thick around the cell perimeter.
 * Half-cells share proportional socket volume.
 */
function computeBaseSocketVolume(widthUnits: number, depthUnits: number): number {
  // Each 1×1 cell: ~42×42mm footprint, socket shell ~3.5mm thick, 5mm deep
  const cellSize = GRIDFINITY.GRID_SIZE;
  const shellThickness = 3.5; // approximate average socket shell thickness
  const outerArea = cellSize * cellSize;
  const innerSide = cellSize - 2 * shellThickness;
  const innerArea = innerSide * innerSide;
  const shellArea = outerArea - innerArea;
  const volumePerFullCell = shellArea * GRIDFINITY.SOCKET_HEIGHT;

  // Scale by actual grid area (handles fractional cells like 1.5×2)
  return volumePerFullCell * widthUnits * depthUnits;
}

/**
 * Volume of stacking lip (4.4mm tall perimeter profile on top of bin).
 *
 * The lip is a thin-walled band around the bin perimeter. We approximate
 * it as a rectangular ring with average width ~2mm.
 */
function computeStackingLipVolume(outerW: number, outerD: number): number {
  const lipThickness = 2; // mm average wall thickness of lip profile
  const perimeter = 2 * (outerW + outerD);
  return perimeter * lipThickness * GRIDFINITY.LIP_HEIGHT;
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
/**
 * Volume of label tabs (one per compartment column, back wall).
 *
 * Each tab consists of:
 * - Shelf: horizontal plate (depth × width × wallThickness)
 * - Support: bracket gussets or solid triangle underneath
 */
function computeLabelTabVolume(params: BinParams, outerW: number, wallThickness: number): number {
  const { cols } = params.compartments;
  const { depth: tabDepth, width: widthPercent, support } = params.label;

  const innerW = outerW - 2 * wallThickness;
  const colWidth = innerW / cols;
  const tabWidth = (colWidth * widthPercent) / 100;

  // Shelf: horizontal plate
  const shelfThickness = wallThickness;
  const shelfVolume = tabDepth * tabWidth * shelfThickness;

  // Support structure beneath the shelf
  let supportVolume: number;
  if (support === 'bracket') {
    // Two triangular gussets per tab
    const gussetSize = tabDepth;
    supportVolume = 2 * 0.5 * gussetSize * gussetSize * wallThickness;
  } else {
    // Solid triangular fill
    supportVolume = 0.5 * tabDepth * tabDepth * wallThickness;
  }

  return cols * (shelfVolume + supportVolume);
}

/**
 * Volume removed by scoop ramp (negative contribution).
 *
 * Each scoop is approximated as a quarter-cylinder carved from
 * the front of a compartment.
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
  const totalH = params.height * GRIDFINITY.HEIGHT_UNIT;
  const wallHeight = isFlat ? totalH : totalH - GRIDFINITY.SOCKET_HEIGHT;
  const interiorHeight = computeInteriorHeight(wallHeight, hasLip, GRIDFINITY.LIP_SMALL_TAPER);
  const lipTaperWidth = GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER;

  // Use representative compartment (single-row bins are front row, multi-row are not)
  const isRepresentativeMinRow = rows === 1;
  const lipOffset = computeLipOffset(hasLip, isRepresentativeMinRow, lipTaperWidth, wallThickness);
  const scoopRadius = resolveScoopRadius(
    params.scoop.radius,
    colWidth,
    rowDepth,
    isRepresentativeMinRow,
    hasLip,
    wallHeight,
    interiorHeight,
    lipOffset
  );

  const numScoops = cols * rows;

  // Quarter-cylinder: π/4 × r² × width (across compartment)
  const volumePerScoop = (Math.PI / 4) * scoopRadius * scoopRadius * colWidth;

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
  const MIN_BOTTOM_KEEP_OUT = 1.0;

  const wallHeight = totalH - bottomH;
  const bottomKeepOut = Math.max(MIN_BOTTOM_KEEP_OUT, wallThickness);
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
