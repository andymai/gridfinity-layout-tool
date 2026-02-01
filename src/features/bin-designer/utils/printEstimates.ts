/**
 * Print estimate calculations for the bin designer.
 *
 * Analytically computes material volume from bin parameters,
 * then derives filament usage and print time estimates.
 *
 * Volume is computed as:
 *   shell + base socket + stacking lip + dividers + gussets + label tabs − scoops
 *
 * This avoids expensive mesh-based volume integration.
 */

import type { BinParams } from '@/features/bin-designer/types';
import { GRIDFINITY, STYLE_WALL_THICKNESS } from '@/features/bin-designer/constants/gridfinity';
import { getStyleConstraints } from '@/features/bin-designer/utils/styleConstraints';
import {
  PLA_DENSITY,
  FILAMENT_AREA_MM2,
  OVERHEAD_MINUTES,
  MINUTES_PER_METER,
  DEFAULT_PRINT_SETTINGS,
  scalePrintTime,
  type PrintSettings,
} from '@/shared/printSettings';

// ─── Result Type ─────────────────────────────────────────────────────────────

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

// ─── Public API ──────────────────────────────────────────────────────────────

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

  // Base time at calibration settings, then scale for user's layer height / infill
  const baseTimeMinutes = OVERHEAD_MINUTES + metersFilament * MINUTES_PER_METER;
  const printTimeMinutes = scalePrintTime(baseTimeMinutes, printSettings);

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

// ─── Volume Calculation ──────────────────────────────────────────────────────

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
  const constraints = getStyleConstraints(params.style);

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

  // Divider volumes
  if (!constraints.disabledFeatures.includes('dividers')) {
    volume += computeDividerVolume(params, outerW, outerD, totalH, wallThickness, bottomH);
  }

  // Corner gussets
  if (constraints.hasGussets) {
    const gussetSize = wallThickness * 2;
    const gussetHeight = totalH - bottomH;
    // 4 triangular prisms: volume = 0.5 * size * size * height each
    volume += 4 * 0.5 * gussetSize * gussetSize * gussetHeight;
  }

  // Label tabs (shelf + support structure)
  if (params.label.enabled && !constraints.disabledFeatures.includes('label')) {
    volume += computeLabelTabVolume(params, outerW, wallThickness);
  }

  // Scoops (remove material from compartment front walls)
  if (params.scoop.enabled) {
    volume -= computeScoopVolume(params, outerW, outerD, wallThickness);
  }

  // Eco: Honeycomb floor (removes material from floor)
  if (params.eco.honeycombFloor.enabled && !params.eco.sinusoidalWall.enabled) {
    volume -= computeHoneycombFloorReduction(params, outerW, outerD, wallThickness);
  }

  // Eco: Honeycomb walls (removes material from outer walls)
  if (params.eco.honeycombWall.mode !== 'none' && !params.eco.sinusoidalWall.enabled) {
    volume -= computeHoneycombWallReduction(
      params,
      outerW,
      outerD,
      totalH - bottomH,
      wallThickness
    );
  }

  // Eco: Sinusoidal walls (replace hollow box shell with wave walls)
  if (params.eco.sinusoidalWall.enabled) {
    // Subtract the standard shell volume and add wave wall volume instead
    const standardShellVolume = computeHollowBoxVolume(
      outerW,
      outerD,
      totalH,
      wallThickness,
      bottomH
    );
    const waveVolume = computeSinusoidalWallVolume(params, outerW, outerD, totalH - bottomH);
    volume = volume - standardShellVolume + waveVolume;
  }

  // Volume cannot be negative (scoops on tiny bins)
  return Math.max(0, volume);
}

// ─── Shell & Structure ───────────────────────────────────────────────────────

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

// ─── Dividers ────────────────────────────────────────────────────────────────

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

// ─── Interior Features ───────────────────────────────────────────────────────

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
  let supportVolume = 0;
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

  // Resolve 'auto' radius
  const scoopRadius =
    params.scoop.radius === 'auto'
      ? Math.min(Math.min(colWidth, rowDepth) / 3, 15)
      : params.scoop.radius;

  // Count scooped compartments: front row only, or all rows
  const numScoops = params.scoop.allRows ? cols * rows : cols;

  // Quarter-cylinder: π/4 × r² × width (across compartment)
  const volumePerScoop = (Math.PI / 4) * scoopRadius * scoopRadius * colWidth;

  return numScoops * volumePerScoop;
}

// ─── Eco Mode Volume ────────────────────────────────────────────────────────

/**
 * Volume removed by honeycomb floor pattern.
 *
 * Approximates as hex packing density (~90.7%) of the usable floor area,
 * minus margins, times floor thickness.
 */
function computeHoneycombFloorReduction(
  params: BinParams,
  outerW: number,
  outerD: number,
  wallThickness: number
): number {
  const { honeycombFloor } = params.eco;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const margin = honeycombFloor.margin;

  const usableW = innerW - 2 * margin;
  const usableD = innerD - 2 * margin;
  if (usableW <= 0 || usableD <= 0) return 0;

  // Circle packing density ≈ π/(2√3) ≈ 0.9069
  const packingDensity = Math.PI / (2 * Math.sqrt(3));
  // Each circle area = π × (cellSize/2)²; packing fills ~90.7% of usable area
  const removalArea = usableW * usableD * packingDensity;
  // Floor thickness = wall thickness
  return removalArea * wallThickness;
}

/**
 * Volume removed by honeycomb wall pattern.
 *
 * For each wall, computes the pattern zone area and applies packing density.
 * Pocketed mode: 60% of wall thickness. Perforated: full wall thickness.
 */
function computeHoneycombWallReduction(
  params: BinParams,
  outerW: number,
  outerD: number,
  wallHeight: number,
  wallThickness: number
): number {
  const { honeycombWall } = params.eco;
  if (honeycombWall.mode === 'none') return 0;

  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const patternHeight = wallHeight - honeycombWall.topMargin - honeycombWall.bottomMargin;
  if (patternHeight <= 0) return 0;

  const cutDepth = honeycombWall.mode === 'pocketed' ? wallThickness * 0.6 : wallThickness;

  const packingDensity = Math.PI / (2 * Math.sqrt(3));

  // Two width-axis walls + two depth-axis walls
  const totalPatternArea = 2 * innerW * patternHeight + 2 * innerD * patternHeight;
  return totalPatternArea * packingDensity * cutDepth;
}

/**
 * Volume of sinusoidal wave walls (replaces hollow box volume).
 *
 * Each wave wall is approximated as a rectangular slab with the
 * cross-sectional area of the sine wave membrane.
 * Sine wave average thickness ≈ baseThickness (the wave adds lateral
 * displacement but doesn't change the cross-section volume significantly).
 */
function computeSinusoidalWallVolume(
  params: BinParams,
  outerW: number,
  outerD: number,
  wallHeight: number
): number {
  const { sinusoidalWall } = params.eco;
  const baseThickness = sinusoidalWall.baseThickness;

  // Floor plate (same as standard)
  const floorVolume = outerW * outerD * params.wallThickness;

  // Four walls: wall length × wall height × membrane thickness
  // Sine wave path is longer than straight line by factor ~√(1 + (2πfA/L)²)
  // but cross-section is baseThickness, so volume ≈ length × height × baseThickness
  const wallVolume = 2 * (outerW + outerD) * wallHeight * baseThickness;

  // Corner posts
  const postSize = Math.max(
    2,
    params.wallThickness +
      (sinusoidalWall.amplitude === 'auto' ? params.wallThickness * 1.5 : sinusoidalWall.amplitude)
  );
  const cornerVolume = 4 * postSize * postSize * wallHeight;

  return floorVolume + wallVolume + cornerVolume;
}

/**
 * Calculate eco savings compared to standard bin.
 *
 * @param params Current bin parameters (with eco config)
 * @param printSettings User print settings
 * @returns Savings percentage and both estimates
 */
export function calculateEcoSavings(
  params: BinParams,
  printSettings: PrintSettings = DEFAULT_PRINT_SETTINGS
): {
  savingsPercent: number;
  ecoEstimate: PrintEstimate;
  standardEstimate: PrintEstimate;
} {
  const ecoEstimate = estimatePrint(params, printSettings);

  // Build standard params (eco disabled) for comparison
  const standardParams: BinParams = {
    ...params,
    eco: {
      honeycombFloor: { ...params.eco.honeycombFloor, enabled: false },
      honeycombWall: { ...params.eco.honeycombWall, mode: 'none' },
      sinusoidalWall: { ...params.eco.sinusoidalWall, enabled: false },
    },
  };
  const standardEstimate = estimatePrint(standardParams, printSettings);

  const savingsPercent =
    standardEstimate.volumeMm3 > 0
      ? Math.round(
          ((standardEstimate.volumeMm3 - ecoEstimate.volumeMm3) / standardEstimate.volumeMm3) * 100
        )
      : 0;

  return { savingsPercent, ecoEstimate, standardEstimate };
}
