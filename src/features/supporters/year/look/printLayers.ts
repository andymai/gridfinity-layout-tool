import { BEAT, clamp01, easeOut, onGrid } from './motion';

/** Layers the print effect slices a part into. */
export const PRINT_LAYERS = 30;

/**
 * How much surface each horizontal layer of a Z-up mesh holds: a slicer
 * spends longer on layers with more material, so the print slows there.
 */
export function layerWeights(
  vertices: ArrayLike<number>,
  indices: ArrayLike<number>,
  layers: number
): number[] {
  const weights = Array.from({ length: layers }, () => 0);
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 2; i < vertices.length; i += 3) {
    const z = vertices[i] ?? 0;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const height = maxZ - minZ;
  if (!(height > 0)) return weights.map(() => 1);
  const count = indices.length > 0 ? indices.length : vertices.length / 3;
  const at = (n: number): number => (indices.length > 0 ? (indices[n] ?? 0) : n);
  for (let n = 0; n + 2 < count; n += 3) {
    const a = at(n) * 3;
    const b = at(n + 1) * 3;
    const c = at(n + 2) * 3;
    const ax = vertices[a] ?? 0;
    const ay = vertices[a + 1] ?? 0;
    const az = vertices[a + 2] ?? 0;
    const ux = (vertices[b] ?? 0) - ax;
    const uy = (vertices[b + 1] ?? 0) - ay;
    const uz = (vertices[b + 2] ?? 0) - az;
    const vx = (vertices[c] ?? 0) - ax;
    const vy = (vertices[c + 1] ?? 0) - ay;
    const vz = (vertices[c + 2] ?? 0) - az;
    const area = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    const zMid = (az + (vertices[b + 2] ?? 0) + (vertices[c + 2] ?? 0)) / 3;
    const layer = Math.min(layers - 1, Math.max(0, Math.floor(((zMid - minZ) / height) * layers)));
    weights[layer] = (weights[layer] ?? 0) + area;
  }
  return weights;
}

/** When each layer lands, every one on a 64th-note tick, the busy layers taking longer. */
export function layerStarts(weights: readonly number[], start: number, span: number): number[] {
  const max = Math.max(0, ...weights) || 1;
  const scaled = weights.map((weight) => 0.35 + weight / max);
  const total = scaled.reduce((sum, weight) => sum + weight, 0);
  const starts: number[] = [];
  let acc = 0;
  for (const weight of scaled) {
    starts.push(onGrid(start + (span * acc) / total, BEAT / 16));
    acc += weight;
  }
  return starts;
}

export interface PrintState {
  /** Fraction of the part's height printed so far; 1 when done. */
  readonly printed: number;
  /** Fraction where the white-hot band of the newest layer starts. */
  readonly hotFrom: number;
  readonly hotOpacity: number;
}

/** The print at time `t`: the layers down so far and how hot the newest still is. */
export function printStateAt(starts: readonly number[], t: number): PrintState {
  const layers = starts.length;
  let newest = -1;
  for (let k = 0; k < layers; k++) if (t >= (starts[k] ?? Infinity)) newest = k;
  if (newest < 0) return { printed: 0, hotFrom: 0, hotOpacity: 0 };
  const printed = newest === layers - 1 ? 1 : (newest + 1) / layers;
  const hotOpacity = 1 - easeOut(clamp01((t - (starts[newest] ?? 0)) / 0.35));
  return { printed, hotFrom: Math.max(0, (newest - 0.5) / layers), hotOpacity };
}
