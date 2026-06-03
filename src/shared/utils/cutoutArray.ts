/**
 * Pure placement math for parametric cutout arrays. Lives in `shared/` so the
 * generation worker and the 2D editor derive identical instance positions from
 * the same `CutoutArrayConfig`.
 *
 * An array's instances are expressed as offsets from the master cutout's
 * center, in the bin-interior frame (mm, X right, Y up). Instance 0 is always
 * the master itself (offset 0, no extra rotation), so the master stays a real
 * cut in every mode and arrays compose with the existing single-cutout
 * positioning. The grid is world-axis-aligned (independent of master rotation).
 */

import type { Cutout, CutoutArrayConfig } from '@/features/bin-designer/types';
import { MAX_ARRAY_INSTANCES } from '@/features/bin-designer/types';

export interface ArrayInstance {
  /** Center offset from the master center (mm). */
  readonly dx: number;
  readonly dy: number;
  /** Extra rotation (deg) added on top of the master's rotation. */
  readonly drot: number;
  /** True for instance 0 — the master — so the editor can mark it. */
  readonly isMaster: boolean;
}

const clampCount = (n: number): number => Math.max(1, Math.round(Number.isFinite(n) ? n : 1));

function dir(angleDeg: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(a), y: Math.sin(a) };
}

/**
 * Total instance count an array expands to (clamped to MAX_ARRAY_INSTANCES).
 * Cheap — for UI display and pre-flight guards.
 */
export function arrayInstanceCount(config: CutoutArrayConfig): number {
  const raw =
    config.mode === 'radial'
      ? clampCount(config.count)
      : clampCount(config.cols) * clampCount(config.rows);
  return Math.min(raw, MAX_ARRAY_INSTANCES);
}

/**
 * Derive every instance placement for an array. Returns offsets from the master
 * center; index 0 is the master. Empty offsets array would never happen (always
 * ≥ the master), but the result is capped at MAX_ARRAY_INSTANCES.
 */
export function arrayInstances(config: CutoutArrayConfig): ArrayInstance[] {
  const out: ArrayInstance[] = [];
  const cap = MAX_ARRAY_INSTANCES;

  if (config.mode === 'radial') {
    const count = Math.min(clampCount(config.count), cap);
    const r = Math.max(0, config.radius);
    const step = 360 / count;
    const base = dir(config.startAngle);
    for (let k = 0; k < count; k++) {
      const angle = config.startAngle + k * step;
      const d = dir(angle);
      out.push({
        dx: r * (d.x - base.x),
        dy: r * (d.y - base.y),
        drot: config.rotateToCenter ? k * step : 0,
        isMaster: k === 0,
      });
    }
    return out;
  }

  // grid / staggered
  const cols = clampCount(config.cols);
  const rows = clampCount(config.rows);
  const staggered = config.mode === 'staggered';
  for (let row = 0; row < rows; row++) {
    const rowOffset = staggered && row % 2 === 1 ? config.pitchX / 2 : 0;
    for (let col = 0; col < cols; col++) {
      if (out.length >= cap) return out;
      out.push({
        dx: col * config.pitchX + rowOffset,
        dy: row * config.pitchY,
        drot: 0,
        isMaster: row === 0 && col === 0,
      });
    }
  }
  return out;
}

/**
 * Expand an array master into concrete cutouts — one per instance, with the
 * array stripped, positioned/rotated per {@link arrayInstances}. Instance 0
 * keeps the master's exact placement. Used by the generator (cut tools) and the
 * editor (instance meshes). Returns `[cutout]` unchanged when there's no array.
 *
 * Derived ids are `${master.id}::a${i}` so the editor can key meshes; routing a
 * click back to the master is the caller's job (it knows the master id).
 */
export function expandCutoutArray(cutout: Cutout): Cutout[] {
  if (!cutout.array) return [cutout];
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  return arrayInstances(cutout.array).map((inst, i) => {
    if (inst.isMaster) {
      const { array: _a, ...rest } = cutout;
      return { ...rest, id: `${cutout.id}::a${i}` };
    }
    const { array: _a, ...rest } = cutout;
    return {
      ...rest,
      id: `${cutout.id}::a${i}`,
      x: cx + inst.dx - cutout.width / 2,
      y: cy + inst.dy - cutout.depth / 2,
      rotation: (((cutout.rotation + inst.drot) % 360) + 360) % 360,
    };
  });
}

/** A sensible default config for a freshly-enabled array, sized off the master. */
export function defaultArrayConfig(masterWidth: number, masterDepth: number): CutoutArrayConfig {
  // Pitch leaves a small gap so instances don't touch by default.
  const pitchX = Math.max(2, masterWidth + 4);
  const pitchY = Math.max(2, masterDepth + 4);
  return {
    mode: 'grid',
    cols: 3,
    rows: 2,
    pitchX,
    pitchY,
    count: 6,
    radius: Math.max(masterWidth, masterDepth) + 12,
    startAngle: 0,
    rotateToCenter: true,
  };
}
