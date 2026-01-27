/**
 * Print estimate calculations for the bin designer.
 *
 * Analytically computes material volume from bin parameters,
 * then derives filament usage and print time estimates.
 *
 * Volume is computed as: outer shell + dividers + gussets (minus cavity).
 * This avoids expensive mesh-based volume integration.
 */

import type { BinParams } from '@/features/bin-designer/types';
import { GRIDFINITY, STYLE_WALL_THICKNESS } from '@/features/bin-designer/constants/gridfinity';
import { getStyleConstraints } from '@/features/bin-designer/utils/styleConstraints';

// ─── Material Constants ──────────────────────────────────────────────────────

/** PLA density in g/cm³ */
const PLA_DENSITY = 1.24;

/** 1.75mm filament cross-section area in mm² */
const FILAMENT_AREA_MM2 = Math.PI * (1.75 / 2) ** 2;

/** Default cost per kg of filament (USD) */
const DEFAULT_COST_PER_KG = 25;

/** Print speed constants (calibrated for 0.4mm nozzle, 0.2mm layer, 15% infill) */
const OVERHEAD_MINUTES = 16; // Bed heat, first layer
const MINUTES_PER_METER = 3.6; // Extrusion + travel

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
 * @param costPerKg - Filament cost in USD/kg (default $25)
 * @returns Print estimates including volume, mass, filament length, time, and cost
 */
export function estimatePrint(
  params: BinParams,
  costPerKg: number = DEFAULT_COST_PER_KG
): PrintEstimate {
  const volumeMm3 = computeBinVolume(params);
  const volumeCm3 = volumeMm3 / 1000; // mm³ → cm³
  const gramsFilament = volumeCm3 * PLA_DENSITY;
  const metersFilament = volumeMm3 / FILAMENT_AREA_MM2 / 1000; // mm³ → mm length → m
  const printTimeMinutes = OVERHEAD_MINUTES + metersFilament * MINUTES_PER_METER;
  const costUSD = (gramsFilament / 1000) * costPerKg; // g → kg × $/kg

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
 * 2. Divider walls
 * 3. Corner gussets (solid style)
 *
 * Label tabs are small relative to the bin volume
 * and are included as minor additions rather than subtractions.
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

  return volume;
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
