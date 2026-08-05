import type { BinParams } from '@/shared/types/bin';

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

/** Grid footprint in units, e.g. `2×4×4`. */
export function formatGridSize(params: BinParams): string {
  return `${format(params.width)}×${format(params.depth)}×${format(params.height)}`;
}

/**
 * Nominal outer size in millimetres. Nominal rather than the printed outer
 * dimension: this answers "how much drawer does it take", which is the pitch
 * it occupies, not the size minus the fit tolerance.
 *
 * `gridUnitMmY` is optional and means a non-square grid; falling back to
 * `gridUnitMm` would silently report a 42×22 design as square.
 */
export function formatMillimetres(params: BinParams): string {
  const unitY = params.gridUnitMmY ?? params.gridUnitMm;
  const width = format(params.width * params.gridUnitMm);
  const depth = format(params.depth * unitY);
  const height = format(params.height * params.heightUnitMm);
  return `${width} × ${depth} × ${height} mm`;
}
