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
 * Floor + base socket feet material per unit of cell footprint area (mm³/mm²).
 * Per unit AREA so it scales to other grid pitches (half-pitch sockets, say)
 * without hardcoding the reference pitch.
 *
 * Re-derive by least squares over `OCCT_GROUND_TRUTH`, holding `WALL_EFF` and
 * `LIP_AREA`. Any change to the floor or the socket invalidates it.
 */
const BASE_VOL_PER_CELL_AREA = 6.1441;

/**
 * The FEET alone, per unit of cell footprint area (mm³/mm²) — the part of
 * {@link BASE_VOL_PER_CELL_AREA} that detaching the feet removes.
 *
 * Measured, not apportioned: 7285mm³ per 42mm cell, which is what a bin loses
 * when its socket goes and only its floor slab remains. The remainder — the
 * floor at 1.2487 mm³/mm² — is what says the split falls where it should.
 */
const FOOT_VOL_PER_CELL_AREA = 4.1298;

/**
 * Volume of one detachable foot, per unit of cell footprint area (mm³/mm²), by
 * the solid it is.
 *
 * Measured at spec pitch: 1895 / 1019 / 1388 mm³ per 42mm cell. Per-area like
 * every other term here, so it follows a custom pitch — approximately, in the
 * way the base term already is, because a foot is a strip and scales closer to
 * a cell's SIDE than to its area.
 */
const DETACHABLE_FOOT_VOL_PER_CELL_AREA = {
  L: 1.0741,
  barEdge: 0.5777,
  barCentred: 0.7867,
} as const;

/** Material the integral feet contribute, and so what detaching them removes. */
export function integralFeetVolume(
  widthUnits: number,
  depthUnits: number,
  gridUnitMm: number,
  gridUnitMmY: number
): number {
  const cells = widthUnits * depthUnits;
  if (cells <= 0) return 0;
  return FOOT_VOL_PER_CELL_AREA * gridUnitMm * gridUnitMmY * cells;
}

/** Material the detachable feet add back, by what each one actually is. */
export function detachableFeetVolume(
  kinds: readonly ('L' | 'barEdge' | 'barCentred')[],
  gridUnitMm: number,
  gridUnitMmY: number
): number {
  const area = gridUnitMm * gridUnitMmY;
  return kinds.reduce((sum, kind) => sum + DETACHABLE_FOOT_VOL_PER_CELL_AREA[kind] * area, 0);
}

/** Stacking-lip cross-sectional area (mm²) per unit of outer perimeter. */
const LIP_AREA = 0.223;

/**
 * Material a lightweight base removes, per unit of cell footprint area
 * (mm³/mm²), keyed by relief direction and whether the feet are subdivided.
 *
 * Measured, not derived: generating each variant and differencing against the
 * same bin with a solid base gives a per-cell figure that is constant to the
 * millimetre across 1x1, 2x2 and 3x3 — 6398 / 5174 / 4332 / 2458 mm³ per 42mm
 * cell — which is what makes a per-cell-area term the right shape for it. A
 * base-only bin measures 5173, i.e. the same relief, confirming the saving is a
 * property of the foot alone and transfers to any body sitting on it.
 *
 * The underside relief saves less than the interior mode because it holds a
 * wider border back around each foot (UNDERSIDE_RELIEF_BORDER_MM against
 * `wallThickness`), and half sockets save least of all: subdividing a cell into
 * four feet quadruples the wall the shell has to leave standing.
 *
 * Approximate for the layouts the model has never described — a partial cell
 * mask, a fractional edge foot, or the `half` foot lattice — in exactly the way
 * the base term above already is.
 */
const LIGHTWEIGHT_SAVING_PER_CELL_AREA = {
  interior: { full: 3.627, half: 2.4558 },
  underside: { full: 2.9331, half: 1.3934 },
} as const;

/**
 * Material (mm³) a lightweight base removes from {@link StandardBinComponents.base}.
 *
 * Takes plain booleans rather than the designer's `BaseConfig` so this module
 * stays a leaf of `@/shared/printSettings` — the caller has already resolved
 * whether the relief is active.
 */
export function lightweightBaseSaving(
  widthUnits: number,
  depthUnits: number,
  underside: boolean,
  halfSockets: boolean,
  gridUnitMm: number = GRIDFINITY_SPEC.GRID_SIZE,
  gridUnitMmY: number = gridUnitMm
): number {
  const cells = widthUnits * depthUnits;
  if (cells <= 0) return 0;
  const perArea =
    LIGHTWEIGHT_SAVING_PER_CELL_AREA[underside ? 'underside' : 'interior'][
      halfSockets ? 'half' : 'full'
    ];
  return perArea * gridUnitMm * gridUnitMmY * cells;
}

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
  heightUnitMm: number = GRIDFINITY_SPEC.HEIGHT_UNIT,
  // Y-axis pitch for non-square grids; defaults to the X pitch (square grid),
  // so every existing square-grid caller is unaffected.
  gridUnitMmY: number = gridUnitMm
): StandardBinComponents {
  const outerW = widthUnits * gridUnitMm - GRIDFINITY_SPEC.TOLERANCE;
  const outerD = depthUnits * gridUnitMmY - GRIDFINITY_SPEC.TOLERANCE;
  const heightMm = heightUnits * heightUnitMm;

  if (outerW <= 0 || outerD <= 0 || heightMm <= 0) {
    return { walls: 0, base: 0, lip: 0 };
  }

  const perimeter = 2 * (outerW + outerD);
  const cells = widthUnits * depthUnits;
  // Floor + feet scale with cell footprint area, so a smaller grid pitch
  // holds proportionally less base material.
  const cellArea = gridUnitMm * gridUnitMmY;

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
  heightUnitMm: number = GRIDFINITY_SPEC.HEIGHT_UNIT,
  gridUnitMmY: number = gridUnitMm
): number {
  const { walls, base, lip } = standardBinSolidComponents(
    widthUnits,
    depthUnits,
    heightUnits,
    gridUnitMm,
    heightUnitMm,
    gridUnitMmY
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
  heightUnitMm: number = GRIDFINITY_SPEC.HEIGHT_UNIT,
  gridUnitMmY: number = gridUnitMm
): StandardBinEstimate {
  const volumeMm3 = estimateStandardBinVolume(
    widthUnits,
    depthUnits,
    heightUnits,
    gridUnitMm,
    heightUnitMm,
    gridUnitMmY
  );

  return estimateFromVolume(volumeMm3, settings);
}

/**
 * Estimate filament from a MEASURED solid volume (mm³) — e.g. the Manifold
 * volume of an imported bin STL. More accurate than the standard-bin model
 * for arbitrary geometry: bin walls print solid, so measured solid volume ≈
 * extruded plastic (infill only matters for thick solid regions, which
 * Gridfinity bins barely have).
 */
export function estimateMeshFilament(
  volumeMm3: number,
  settings: PrintSettings = DEFAULT_PRINT_SETTINGS
): StandardBinEstimate {
  return estimateFromVolume(volumeMm3, settings);
}

function estimateFromVolume(volumeMm3: number, settings: PrintSettings): StandardBinEstimate {
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
