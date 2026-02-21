/**
 * Analytical volume estimation for standard gridfinity bins.
 *
 * Computes material volume for bins with default features:
 *   perimeter walls + floor + base socket + stacking lip
 *
 * Used by print-export to estimate filament for layout bins, which only
 * have width/depth/height (no BinParams). Assumes standard gridfinity
 * defaults: 2-perimeter walls, socket interface, stacking lip, no
 * dividers, scoops, or labels.
 *
 * Unlike the bin-designer's full estimator (which computes solid geometry
 * for relative feature comparisons), this model uses calibrated geometry
 * constants tuned to match actual slicer output within ±30%.
 */

import {
  PLA_DENSITY,
  FILAMENT_AREA_MM2,
  OVERHEAD_MINUTES,
  MINUTES_PER_METER,
  scalePrintTime,
  type PrintSettings,
  DEFAULT_PRINT_SETTINGS,
} from '@/shared/printSettings';
import { GRIDFINITY_SPEC, wallThicknessForNozzle } from './gridfinityGeometry';

// ─── Calibration Constants ───────────────────────────────────────────────────

/**
 * Effective floor thickness in mm (solid layers above socket cavities).
 * Typical gridfinity bins have ~3 solid bottom layers at 0.2mm = 0.6mm.
 * This is much thinner than the full 7mm base height because the socket
 * region below the floor is already computed separately.
 */
const FLOOR_THICKNESS = 0.6;

/**
 * Effective socket shell thickness in mm.
 * The actual socket is a tapered chamfered profile (~1.2mm average wall),
 * thinner than the bin-designer's 3.5mm approximation which is designed
 * for conservative relative comparisons, not absolute filament estimation.
 */
const SOCKET_SHELL_THICKNESS = 1.2;

// ─── Result Type ─────────────────────────────────────────────────────────────

export interface StandardBinEstimate {
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
 * Estimate material volume (mm³) for a standard gridfinity bin.
 *
 * Decomposes the bin into four structural components:
 * 1. Perimeter walls — full height from bottom to rim
 * 2. Floor — thin solid layer above the socket cavities
 * 3. Base socket — per-cell interface that slides onto baseplate
 * 4. Stacking lip — top perimeter profile
 *
 * @param widthUnits - Bin width in grid units (e.g., 1, 1.5, 2)
 * @param depthUnits - Bin depth in grid units
 * @param heightUnits - Bin height in height units (includes base)
 * @param nozzleSizeMm - Nozzle diameter for wall thickness calculation
 * @returns Volume in mm³
 */
export function estimateStandardBinVolume(
  widthUnits: number,
  depthUnits: number,
  heightUnits: number,
  nozzleSizeMm: number = 0.4
): number {
  const wall = wallThicknessForNozzle(nozzleSizeMm);

  // Outer dimensions in mm
  const outerW = widthUnits * GRIDFINITY_SPEC.GRID_SIZE - GRIDFINITY_SPEC.TOLERANCE;
  const outerD = depthUnits * GRIDFINITY_SPEC.GRID_SIZE - GRIDFINITY_SPEC.TOLERANCE;
  const totalH = heightUnits * GRIDFINITY_SPEC.HEIGHT_UNIT;

  let volume = 0;

  // 1. Perimeter walls (full height — no solid base slab)
  volume += computeWallsVolume(outerW, outerD, totalH, wall);

  // 2. Floor (thin solid layer above socket cavities)
  volume += computeFloorVolume(outerW, outerD, wall);

  // 3. Base socket (per-cell interface to baseplate)
  volume += computeBaseSocketVolume(widthUnits, depthUnits);

  // 4. Stacking lip (top perimeter)
  volume += computeStackingLipVolume(outerW, outerD);

  return Math.max(0, volume);
}

/**
 * Estimate full print details for a standard gridfinity bin.
 *
 * Convenience wrapper that converts volume to filament, time, and cost.
 *
 * @param widthUnits - Bin width in grid units
 * @param depthUnits - Bin depth in grid units
 * @param heightUnits - Bin height in height units
 * @param settings - User print settings
 * @returns Full estimate with volume, mass, length, time, and cost
 */
export function estimateStandardBinFilament(
  widthUnits: number,
  depthUnits: number,
  heightUnits: number,
  settings: PrintSettings = DEFAULT_PRINT_SETTINGS
): StandardBinEstimate {
  const volumeMm3 = estimateStandardBinVolume(
    widthUnits,
    depthUnits,
    heightUnits,
    settings.nozzleSizeMm
  );

  const volumeCm3 = volumeMm3 / 1000;
  const gramsFilament = volumeCm3 * PLA_DENSITY;
  const metersFilament = volumeMm3 / FILAMENT_AREA_MM2 / 1000;

  // Scale only the extrusion portion; overhead (bed heat, etc.) is constant
  const baseExtrusionMinutes = metersFilament * MINUTES_PER_METER;
  const printTimeMinutes = OVERHEAD_MINUTES + scalePrintTime(baseExtrusionMinutes, settings);

  const costUSD = (gramsFilament / 1000) * settings.filamentCostPerKg;

  return {
    volumeMm3: Math.round(volumeMm3),
    gramsFilament: Math.round(gramsFilament * 10) / 10,
    metersFilament: Math.round(metersFilament * 100) / 100,
    printTimeMinutes: Math.round(printTimeMinutes),
    costUSD: Math.round(costUSD * 100) / 100,
  };
}

// ─── Geometry Helpers ────────────────────────────────────────────────────────

/**
 * Volume of perimeter walls (cross-section × full height).
 *
 * Unlike the bin-designer's hollow box model, this does NOT include a solid
 * base slab. The floor and socket are computed separately to avoid
 * double-counting the base region.
 */
function computeWallsVolume(outerW: number, outerD: number, totalH: number, wall: number): number {
  const innerW = outerW - 2 * wall;
  const innerD = outerD - 2 * wall;

  if (innerW <= 0 || innerD <= 0) {
    return outerW * outerD * totalH; // Solid block (walls too thick for bin size)
  }

  const wallCrossSection = outerW * outerD - innerW * innerD;
  return wallCrossSection * totalH;
}

/**
 * Volume of the solid floor layer above socket cavities.
 * Uses FLOOR_THICKNESS (calibrated) rather than the full BASE_HEIGHT.
 */
function computeFloorVolume(outerW: number, outerD: number, wall: number): number {
  const innerW = outerW - 2 * wall;
  const innerD = outerD - 2 * wall;

  if (innerW <= 0 || innerD <= 0) return 0;

  return innerW * innerD * FLOOR_THICKNESS;
}

/**
 * Volume of base socket structure (per-cell interface to baseplate).
 *
 * Each 1×1 cell has a tapered socket profile. Uses SOCKET_SHELL_THICKNESS
 * (calibrated to actual tapered profile average) rather than the
 * bin-designer's more generous 3.5mm approximation.
 */
function computeBaseSocketVolume(widthUnits: number, depthUnits: number): number {
  const cellSize = GRIDFINITY_SPEC.GRID_SIZE;
  const outerArea = cellSize * cellSize;
  const innerSide = cellSize - 2 * SOCKET_SHELL_THICKNESS;
  const innerArea = innerSide * innerSide;
  const shellArea = outerArea - innerArea;
  const volumePerFullCell = shellArea * GRIDFINITY_SPEC.SOCKET_HEIGHT;

  return volumePerFullCell * widthUnits * depthUnits;
}

/**
 * Volume of stacking lip (4.4mm tall perimeter profile).
 * Same as bin-designer: thin-walled band with ~2mm average width.
 */
function computeStackingLipVolume(outerW: number, outerD: number): number {
  const lipThickness = 2;
  const perimeter = 2 * (outerW + outerD);
  return perimeter * lipThickness * GRIDFINITY_SPEC.LIP_HEIGHT;
}
