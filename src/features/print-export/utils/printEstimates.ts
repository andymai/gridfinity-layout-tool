/**
 * Filament cost, time, and spool percentage calculation utilities.
 *
 * Used by the print-export feature for batch estimation of layout bins.
 * Shares constants and time scaling with the bin-designer estimator
 * via the shared printSettings module.
 */

import {
  METERS_PER_KG,
  OVERHEAD_MINUTES,
  MINUTES_PER_METER,
  scalePrintTime,
  DEFAULT_PRINT_SETTINGS,
  type PrintSettings,
} from '@/shared/printSettings';

// Re-export for backward compatibility
export const DEFAULT_METERS_PER_KG = METERS_PER_KG;
export const DEFAULT_COST_PER_KG = DEFAULT_PRINT_SETTINGS.filamentCostPerKg;

/**
 * Calculate cost estimate from filament meters.
 */
export function calcFilamentCost(
  filamentMeters: number,
  costPerKg: number = DEFAULT_PRINT_SETTINGS.filamentCostPerKg,
  metersPerKg: number = METERS_PER_KG
): number {
  const kgUsed = filamentMeters / metersPerKg;
  return Math.round(kgUsed * costPerKg * 100) / 100; // Round to cents
}

/**
 * Calculate percentage of a 1kg spool.
 */
export function calcSpoolPercentage(
  filamentMeters: number,
  metersPerKg: number = METERS_PER_KG
): number {
  return Math.round((filamentMeters / metersPerKg) * 1000) / 10; // 1 decimal, e.g., 15.2%
}

/**
 * Fraction of the grid-aligned bed area realistically usable for bins once
 * brim/skirt margins and imperfect packing are accounted for. Gridfinity bins
 * tile on the grid so packing is efficient, but edges and clearances cost some
 * capacity.
 */
const BED_PACKING_EFFICIENCY = 0.85;

/**
 * Estimate the number of print plates (jobs) needed for a layout.
 *
 * Overhead (bed heating, first layer, cooldown) is incurred once per *plate*,
 * not once per distinct bin type. This replaces the previous `rows.length`
 * heuristic, which charged overhead for every unique size/label/category group
 * and massively inflated time for varied layouts.
 *
 * @param totalFootprintUnits - Total bin footprint in grid cells (Σ width×depth×count)
 * @param bedCapacityUnits - Grid cells that fit on the print bed
 * @returns Whole number of plates (always ≥ 1)
 */
export function estimatePrintJobs(totalFootprintUnits: number, bedCapacityUnits: number): number {
  // Nothing to print → no plates (and no overhead time).
  if (totalFootprintUnits <= 0) return 0;
  const usable = bedCapacityUnits * BED_PACKING_EFFICIENCY;
  if (usable <= 0) return 1; // unknown bed capacity → assume a single plate
  return Math.max(1, Math.ceil(totalFootprintUnits / usable));
}

/**
 * Print time estimate based on filament length and number of print jobs.
 *
 * Computes base extrusion time from filament length, scales it via
 * `scalePrintTime` for nozzle/layer/infill settings, then adds
 * per-job overhead (bed heating, first layer, cooling).
 *
 * The extrusion rate (`MINUTES_PER_METER`) corresponds to an effective
 * volumetric throughput of ~11 mm³/s for a 0.4mm-nozzle PLA print (including
 * perimeters, travel, and acceleration losses) — see `MINUTES_PER_METER` in
 * `@/shared/printSettings`. `numPrintJobs` should be the estimated plate count
 * (see `estimatePrintJobs`), not the number of distinct bin types.
 *
 * Returns hours (1 decimal place).
 */
export function calcPrintTimeHours(
  filamentMeters: number,
  numPrintJobs: number = 1,
  printSettings: PrintSettings = DEFAULT_PRINT_SETTINGS
): number {
  const baseExtrusionMinutes = filamentMeters * MINUTES_PER_METER;
  const scaledExtrusion = scalePrintTime(baseExtrusionMinutes, printSettings);
  const totalMinutes = numPrintJobs * OVERHEAD_MINUTES + scaledExtrusion;
  return Math.round((totalMinutes / 60) * 10) / 10; // 1 decimal hour
}

/**
 * Format print time for display (e.g., "2h 15m" or "45m").
 */
export function formatPrintTime(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Format cost for display (e.g., "$1.50" or "$12.00").
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}
