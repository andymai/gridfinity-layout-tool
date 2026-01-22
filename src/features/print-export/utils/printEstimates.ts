/**
 * Filament cost, time, and spool percentage calculation utilities.
 */

// Constants
export const DEFAULT_METERS_PER_KG = 330; // 1.75mm PLA
export const DEFAULT_COST_PER_KG = 15; // $15/kg baseline

/**
 * Calculate cost estimate from filament meters.
 */
export function calcFilamentCost(
  filamentMeters: number,
  costPerKg: number = DEFAULT_COST_PER_KG,
  metersPerKg: number = DEFAULT_METERS_PER_KG
): number {
  const kgUsed = filamentMeters / metersPerKg;
  return Math.round(kgUsed * costPerKg * 100) / 100; // Round to cents
}

/**
 * Calculate percentage of a 1kg spool.
 */
export function calcSpoolPercentage(
  filamentMeters: number,
  metersPerKg: number = DEFAULT_METERS_PER_KG
): number {
  return Math.round((filamentMeters / metersPerKg) * 1000) / 10; // 1 decimal, e.g., 15.2%
}

/**
 * Print time estimate based on filament length and number of print jobs.
 *
 * Calibrated via least-squares regression on real prints (0.4mm nozzle, 0.2mm layer height, 15% infill):
 * - 1×1×3u (2.3m) = 24 min
 * - 1×2×3u (3.7m) = 30 min
 * - 2×2×3u (5.6m) = 35 min
 * - 3×3×3u (9.9m) = 52 min
 *
 * Model: time = (numJobs × 16 min overhead) + (filament × 3.6 min/m)
 * - Overhead: bed heating, first layer, cooling pauses
 * - Rate: extrusion time, travel moves, retractions
 *
 * Max error: ~1 min per bin across calibration data.
 *
 * Returns hours.
 */
export function calcPrintTimeHours(filamentMeters: number, numPrintJobs: number = 1): number {
  const overheadMinutesPerJob = 16;
  const minutesPerMeter = 3.6;
  const totalMinutes = numPrintJobs * overheadMinutesPerJob + filamentMeters * minutesPerMeter;
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
