import type { BinParams } from '@/shared/types/bin';
import {
  MAX_COMPARTMENT_FLOOR_RAISE_MM,
  MIN_RAISED_CAVITY_MM,
  compartmentHasTiltedEdge,
} from '@/shared/types/bin';

/**
 * Each compartment's raise, clamped so {@link MIN_RAISED_CAVITY_MM} of pocket
 * survives above it. Compartments with no raise, or a tilted edge, are absent.
 */
export function resolveFloorRaises(
  params: BinParams,
  floorZ: number,
  interiorHeight: number
): Map<number, number> {
  const out = new Map<number, number>();
  const raises = params.compartments.floorRaises;
  if (!raises) return out;
  const ceiling = Math.min(
    MAX_COMPARTMENT_FLOOR_RAISE_MM,
    interiorHeight - floorZ - MIN_RAISED_CAVITY_MM
  );
  if (ceiling <= 0) return out;
  const ids = new Set(params.compartments.cells);
  raises.forEach((raise, id) => {
    if (typeof raise !== 'number' || !Number.isFinite(raise) || raise <= 0) return;
    if (!ids.has(id) || compartmentHasTiltedEdge(params.compartments, id)) return;
    out.set(id, Math.min(raise, ceiling));
  });
  return out;
}
