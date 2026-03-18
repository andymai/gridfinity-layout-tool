/**
 * Shared print estimation constants, types, and scaling helpers.
 *
 * Used by both the bin-designer (analytical volume) and print-export
 * (heuristic) estimation systems to ensure consistent defaults and
 * parametric time scaling.
 *
 * Calibrated via least-squares regression on real prints:
 * - Printer: 0.4mm nozzle, 0.2mm layer height, 15% infill
 * - Data: 1×1×3u (2.3m, 24min), 1×2×3u (3.7m, 30min),
 *         2×2×3u (5.6m, 35min), 3×3×3u (9.9m, 52min)
 * - Max error: ~1 min per bin across calibration set
 */
/** PLA density in g/cm³ */
export const PLA_DENSITY = 1.24;

/** 1.75mm filament cross-section area in mm² */
export const FILAMENT_AREA_MM2 = Math.PI * (1.75 / 2) ** 2;

/** Meters of 1.75mm PLA filament per kilogram */
export const METERS_PER_KG = 330;
/** Layer height the time model was calibrated against (mm) */
export const BASELINE_LAYER_HEIGHT = 0.2;

/** Infill % the time model was calibrated against */
export const BASELINE_INFILL = 15;

/** Per-job overhead: bed heating, first layer, cooling (minutes) */
export const OVERHEAD_MINUTES = 16;

/** Extrusion rate: extrusion + travel + retractions (minutes per meter) */
export const MINUTES_PER_METER = 3.6;
/** User-configurable print settings stored in global preferences. */
export interface PrintSettings {
  /** Filament cost in USD per kilogram */
  readonly filamentCostPerKg: number;
  /** Layer height in mm (affects print time) */
  readonly layerHeightMm: number;
  /** Infill percentage 0–100 (affects print time) */
  readonly infillPercent: number;
  /** Nozzle diameter in mm (affects wall thickness and print speed) */
  readonly nozzleSizeMm: number;
}

/** Default print settings matching the calibration baseline. */
export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  filamentCostPerKg: 20,
  layerHeightMm: BASELINE_LAYER_HEIGHT,
  infillPercent: BASELINE_INFILL,
  nozzleSizeMm: 0.4,
};

/** Validation constraints for print settings inputs. */
export const PRINT_SETTINGS_CONSTRAINTS = {
  COST_MIN: 0,
  COST_MAX: 200,
  COST_STEP: 1,
  LAYER_HEIGHT_MIN: 0.08,
  LAYER_HEIGHT_MAX: 0.32,
  LAYER_HEIGHT_STEP: 0.04,
  INFILL_MIN: 5,
  INFILL_MAX: 100,
  INFILL_STEP: 5,
  NOZZLE_SIZE_MIN: 0.2,
  NOZZLE_SIZE_MAX: 1.0,
  NOZZLE_SIZE_STEP: 0.2,
} as const;
/**
 * Scale a baseline print time by the user's print settings.
 *
 * The base time is assumed to be computed at baseline settings (0.2mm layers,
 * 15% infill, 0.4mm nozzle). This function adjusts for three parameters:
 *
 * - Nozzle size: Wider nozzle deposits more plastic per move = faster.
 *   Scale factor = 0.4 / nozzleSizeMm (baseline is 0.4mm).
 * - Layer height: Thinner layers = more layers = proportionally more time.
 *   Scale factor = baseline / actual (inverse: 0.12mm is 1.67× slower than 0.2mm).
 * - Infill: Higher infill adds fill time linearly above the baseline.
 *   Scale factor = 1 + 0.003 × (actual - baseline). Gridfinity bins have
 *   minimal infill area, so the coefficient is lower than general-purpose prints.
 *
 * @param baseMinutes - Print time in minutes at the baseline settings
 * @param settings - User's print settings
 * @returns Scaled print time in minutes
 */
export function scalePrintTime(baseMinutes: number, settings: PrintSettings): number {
  const nozzleSpeedFactor = 0.4 / settings.nozzleSizeMm;
  const layerScale = BASELINE_LAYER_HEIGHT / settings.layerHeightMm;
  const infillScale = 1 + 0.003 * (settings.infillPercent - BASELINE_INFILL);
  return baseMinutes * nozzleSpeedFactor * layerScale * infillScale;
}
export { GRIDFINITY_SPEC, wallThicknessForNozzle } from './gridfinityGeometry';
export type { StandardBinEstimate } from './standardBinVolume';
export { estimateStandardBinVolume, estimateStandardBinFilament } from './standardBinVolume';
