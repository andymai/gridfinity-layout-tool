import { CONSTRAINTS } from '@/core/constants';
import type { CommunityDesignMetrics } from '@/shared/types/community';

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function formatUnits(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Server metrics are outer millimetres (units * gridUnitMm minus the fit
 * tolerance), so dividing by gridUnitMm and rounding to the nearest half unit
 * recovers the published grid footprint exactly, half-bin sizes included.
 * Height has no per-design unit in the metrics payload; the standard 7 mm
 * height unit is the display convention.
 */
export function formatCardDims(metrics: CommunityDesignMetrics): string {
  const width = roundToHalf(metrics.width / metrics.gridUnitMm);
  const depth = roundToHalf(metrics.depth / metrics.gridUnitMm);
  const height = roundToHalf(metrics.height / CONSTRAINTS.HEIGHT_UNIT_MM_DEFAULT);
  return `${formatUnits(width)}×${formatUnits(depth)}×${formatUnits(height)}`;
}
