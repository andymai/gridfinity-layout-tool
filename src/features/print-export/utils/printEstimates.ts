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
 * Print time estimate based on filament length and number of print jobs.
 *
 * Computes base extrusion time from filament length, scales it via
 * `scalePrintTime` for nozzle/layer/infill settings, then adds
 * per-job overhead (bed heating, first layer, cooling).
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
