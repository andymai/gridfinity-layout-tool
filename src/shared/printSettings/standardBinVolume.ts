/**
 * Analytical solid-volume estimation for standard gridfinity bins.
 *
 * Returns the SOLID material volume of a bin with default features
 * (perimeter walls + floor + base socket feet + stacking lip, single
 * compartment). Used by print-export to estimate filament for layout bins,
 * which only carry width/depth/height.
 *
 * The model is a three-term fit to ground-truth solid volumes measured from
 * the real OCCT generator (`measureVolume(getLastSolid())`):
 *
 *   V_solid ≈ perimeter · WALL_EFF · heightMm            (perimeter walls)
 *           + BASE_VOL_PER_CELL_AREA · cellArea · cells  (floor + base feet)
 *           + perimeter · LIP_AREA                        (stacking lip)
 *
 * It reproduces the generated geometry within ~2% across bins from 1×1×2u to
 * 4×4×6u (see standardBinVolume.test.ts for the documented ground-truth set).
 *
 * Two deliberate properties:
 * - The base term scales **per cell** (floor + feet), not per footprint-area-
 *   squared. An earlier `floor = innerArea × thickness` term over-grew with
 *   footprint and produced size-dependent error.
 * - Volume is **independent of nozzle size**. The bin's CAD wall is a fixed
 *   spec thickness; the user's nozzle changes how the slicer fills that wall
 *   and the print speed, never the part volume. Nozzle belongs to the time
 *   model only (see `scalePrintTime`).
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
import { GRIDFINITY_SPEC } from './gridfinityGeometry';

/**
 * Effective solid wall cross-section thickness (mm) per unit of perimeter,
 * calibrated to OCCT geometry. Larger than the nominal spec wall (0.95mm)
 * because it absorbs outer corner rounding and the lip-region wall thickening.
 */
const WALL_EFF = 1.165;

/**
 * Floor + base socket feet material per unit of cell footprint area (mm³/mm²),
 * calibrated to OCCT geometry. At the standard 42mm pitch this is ≈2202mm³ per
 * 42×42 cell; expressing it per unit area lets it scale to other grid pitches
 * (e.g. half-pitch sockets) without hardcoding the reference pitch.
 *   2202 mm³ / (42mm)² ≈ 1.2483 mm³/mm²
 */
const BASE_VOL_PER_CELL_AREA = 1.2483;

/** Stacking-lip cross-sectional area (mm²) per unit of outer perimeter. */
const LIP_AREA = 0.223;

/**
 * The three structural components of a standard bin's solid volume (mm³).
 * Exposed so the bin-designer estimator can reuse the OCCT-calibrated base
 * geometry and add the lip conditionally (and layer its own feature deltas on
 * top) instead of maintaining a divergent copy.
 */
export interface StandardBinComponents {
  /** Perimeter walls (full height). */
  readonly walls: number;
  /** Floor + base socket feet (per cell). */
  readonly base: number;
  /** Stacking lip (perimeter profile). */
  readonly lip: number;
}

/**
 * Decompose a standard bin's solid volume into walls / base / lip (mm³).
 * Returns zeroed components for degenerate (non-positive) geometry.
 */
export function standardBinSolidComponents(
  widthUnits: number,
  depthUnits: number,
  heightUnits: number,
  gridUnitMm: number = GRIDFINITY_SPEC.GRID_SIZE,
  heightUnitMm: number = GRIDFINITY_SPEC.HEIGHT_UNIT
): StandardBinComponents {
  const outerW = widthUnits * gridUnitMm - GRIDFINITY_SPEC.TOLERANCE;
  const outerD = depthUnits * gridUnitMm - GRIDFINITY_SPEC.TOLERANCE;
  const heightMm = heightUnits * heightUnitMm;

  if (outerW <= 0 || outerD <= 0 || heightMm <= 0) {
    return { walls: 0, base: 0, lip: 0 };
  }

  const perimeter = 2 * (outerW + outerD);
  const cells = widthUnits * depthUnits;
  // Floor + feet scale with cell footprint area, so a smaller grid pitch
  // holds proportionally less base material.
  const cellArea = gridUnitMm * gridUnitMm;

  return {
    walls: perimeter * WALL_EFF * heightMm,
    base: BASE_VOL_PER_CELL_AREA * cellArea * cells,
    lip: perimeter * LIP_AREA,
  };
}
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
/**
 * Estimate solid material volume (mm³) for a standard gridfinity bin.
 *
 * @param widthUnits - Bin width in grid units (e.g., 1, 1.5, 2)
 * @param depthUnits - Bin depth in grid units
 * @param heightUnits - Bin height in height units (includes base)
 * @param gridUnitMm - Grid unit size in mm (defaults to standard 42mm)
 * @param heightUnitMm - Height unit size in mm (defaults to standard 7mm)
 * @returns Solid volume in mm³
 */
export function estimateStandardBinVolume(
  widthUnits: number,
  depthUnits: number,
  heightUnits: number,
  gridUnitMm: number = GRIDFINITY_SPEC.GRID_SIZE,
  heightUnitMm: number = GRIDFINITY_SPEC.HEIGHT_UNIT
): number {
  const { walls, base, lip } = standardBinSolidComponents(
    widthUnits,
    depthUnits,
    heightUnits,
    gridUnitMm,
    heightUnitMm
  );
  return Math.max(0, walls + base + lip);
}

/**
 * Estimate full print details for a standard gridfinity bin.
 *
 * Convenience wrapper that converts the solid volume to filament length, mass,
 * print time, and cost. Volume (and therefore filament/mass/cost) is
 * independent of nozzle size; nozzle, layer height, and infill scale the print
 * TIME only.
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
  settings: PrintSettings = DEFAULT_PRINT_SETTINGS,
  gridUnitMm: number = GRIDFINITY_SPEC.GRID_SIZE,
  heightUnitMm: number = GRIDFINITY_SPEC.HEIGHT_UNIT
): StandardBinEstimate {
  const volumeMm3 = estimateStandardBinVolume(
    widthUnits,
    depthUnits,
    heightUnits,
    gridUnitMm,
    heightUnitMm
  );

  const volumeCm3 = volumeMm3 / 1000;
  const gramsFilament = volumeCm3 * PLA_DENSITY;
  const metersFilament = volumeMm3 / FILAMENT_AREA_MM2 / 1000;

  // Scale only the extrusion portion; overhead (bed heat, etc.) is constant.
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
