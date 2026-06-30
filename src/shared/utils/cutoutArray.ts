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
import { MAX_ARRAY_INSTANCES, MAX_ARRAY_COUNT } from '@/features/bin-designer/types';
import { clamp } from './math';

/** Absolute editor caps for array spacing (mm), independent of bin size. */
export const ARRAY_MIN_PITCH = 1;
export const ARRAY_MAX_PITCH = 200;
export const ARRAY_MIN_RADIUS = 1;
export const ARRAY_MAX_RADIUS = 200;

/** Minimum printed wall between adjacent array instances (mm). */
export const ARRAY_MIN_WALL_GAP = 1;

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
      // Path vertices are absolute, so they must move with the instance —
      // otherwise editor previews (and flattened arrays) stack every path
      // instance on the master. Handles are relative offsets and stay as-is.
      // (The worker rebuilds geometry from the master and ignores this path.)
      ...(cutout.path
        ? { path: cutout.path.map((p) => ({ ...p, x: p.x + inst.dx, y: p.y + inst.dy })) }
        : {}),
    };
  });
}

/** Per-field bounds that keep an array within the bin's physical footprint. */
export interface ArrayFieldBounds {
  readonly maxCols: number;
  readonly maxRows: number;
  readonly minPitchX: number;
  readonly minPitchY: number;
  readonly maxPitchX: number;
  readonly maxPitchY: number;
  readonly maxRadius: number;
}

const floorToHalf = (v: number): number => Math.floor(v * 2) / 2;

/**
 * Feasible upper bounds for each array field given the master cutout's size and
 * position and the bin interior. The grid grows in +X/+Y from the master, so a
 * field's max is whatever keeps the furthest instance inside the bin (and the
 * total within {@link MAX_ARRAY_INSTANCES}). Each bound is computed against the
 * other fields as-is, so editing one never silently rewrites the others.
 */
export function arrayFieldBounds(
  cutout: Cutout,
  binWidth: number,
  binDepth: number,
  config: CutoutArrayConfig
): ArrayFieldBounds {
  const { width: w, depth: d } = cutout;
  // Room for the array to grow from the master's far edge to the bin edge.
  const availX = Math.max(0, binWidth - cutout.x - w);
  const availY = Math.max(0, binDepth - cutout.y - d);
  const cols = clampCount(config.cols);
  const rows = clampCount(config.rows);
  // The half-pitch X shift only exists once there's an odd row to shift, so it
  // only widens the footprint when staggered AND rows > 1.
  const stagger = config.mode === 'staggered' && rows > 1 ? config.pitchX / 2 : 0;
  const colExtraSpan = config.mode === 'staggered' && rows > 1 ? 0.5 : 0;

  // How many extra steps fit at the current pitch, plus the master itself.
  const stepsX = config.pitchX > 0 ? Math.floor((availX - stagger) / config.pitchX) : 0;
  const stepsY = config.pitchY > 0 ? Math.floor(availY / config.pitchY) : 0;
  const maxCols = clamp(
    Math.min(1 + Math.max(0, stepsX), Math.floor(MAX_ARRAY_INSTANCES / rows)),
    1,
    MAX_ARRAY_COUNT
  );
  const maxRows = clamp(
    Math.min(1 + Math.max(0, stepsY), Math.floor(MAX_ARRAY_INSTANCES / cols)),
    1,
    MAX_ARRAY_COUNT
  );

  // Largest pitch that keeps the current counts inside the bin.
  const colSpan = cols - 1 + colExtraSpan;
  const rowSpan = rows - 1;
  const maxPitchX = clamp(
    floorToHalf(colSpan > 0 ? availX / colSpan : ARRAY_MAX_PITCH),
    ARRAY_MIN_PITCH,
    ARRAY_MAX_PITCH
  );
  const maxPitchY = clamp(
    floorToHalf(rowSpan > 0 ? availY / rowSpan : ARRAY_MAX_PITCH),
    ARRAY_MIN_PITCH,
    ARRAY_MAX_PITCH
  );

  // Radial ring is centered on the master, so it can only grow until it reaches
  // the nearest bin edge — bound by the master box's smallest edge clearance,
  // which (unlike a bin-wide span) respects an off-center master.
  const edgeClearance = Math.min(
    cutout.x,
    cutout.y,
    binWidth - (cutout.x + w),
    binDepth - (cutout.y + d)
  );
  const maxRadius = clamp(floorToHalf(edgeClearance), ARRAY_MIN_RADIUS, ARRAY_MAX_RADIUS);

  // Minimum pitch that preserves at least ARRAY_MIN_WALL_GAP of material between instances.
  const minPitchX = Math.max(ARRAY_MIN_PITCH, floorToHalf(w) + ARRAY_MIN_WALL_GAP);
  const minPitchY = Math.max(ARRAY_MIN_PITCH, floorToHalf(d) + ARRAY_MIN_WALL_GAP);

  return { maxCols, maxRows, minPitchX, minPitchY, maxPitchX, maxPitchY, maxRadius };
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
