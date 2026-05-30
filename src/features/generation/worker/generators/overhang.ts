/**
 * Per-side bin overhang resolution.
 *
 * Overhang grows the bin's outer body (and stacking lip) outward by a per-side
 * mm amount so the bin can fill the centering gap a non-integral grid leaves in
 * a drawer. The base sockets/feet stay at the nominal footprint, so the
 * overhang region has a flat bottom (no downward-protruding feet).
 *
 * This module is the single source of truth for turning the optional,
 * possibly-negative `OverhangConfig` into clamped, outward-only values plus the
 * derived footprint expansion and asymmetry offset used by the box and lip
 * builders.
 */

import type { OverhangConfig } from '@/shared/types/bin';

/** Outward-only (>= 0) per-side overhang, with no undefined fields. */
export interface ResolvedOverhang {
  readonly left: number;
  readonly right: number;
  readonly front: number;
  readonly back: number;
  /** Add grid-aligned feet under the overhang region (default false). */
  readonly feet: boolean;
}

const ZERO: ResolvedOverhang = { left: 0, right: 0, front: 0, back: 0, feet: false };

/**
 * Footprint expansion derived from an overhang: how much wider/deeper the outer
 * body becomes and how far its center shifts when the two opposite sides differ.
 */
export interface OverhangExpansion {
  /** Total added width (left + right), in mm. */
  readonly addW: number;
  /** Total added depth (front + back), in mm. */
  readonly addD: number;
  /** X shift of the footprint center (positive toward +X), in mm. */
  readonly offsetX: number;
  /** Y shift of the footprint center (positive toward +Y), in mm. */
  readonly offsetY: number;
}

/** Clamp an `OverhangConfig` to outward-only values; absent → all zero. */
export function resolveOverhang(overhang: OverhangConfig | undefined): ResolvedOverhang {
  if (!overhang) return ZERO;
  return {
    left: Math.max(0, overhang.left),
    right: Math.max(0, overhang.right),
    front: Math.max(0, overhang.front),
    back: Math.max(0, overhang.back),
    feet: overhang.feet ?? false,
  };
}

/** True when any side has a non-trivial outward expansion. */
export function hasOverhang(o: ResolvedOverhang): boolean {
  return o.left > 1e-6 || o.right > 1e-6 || o.front > 1e-6 || o.back > 1e-6;
}

/** Derive the footprint expansion + asymmetry offset from a resolved overhang. */
export function overhangExpansion(o: ResolvedOverhang): OverhangExpansion {
  return {
    addW: o.left + o.right,
    addD: o.front + o.back,
    offsetX: (o.right - o.left) / 2,
    offsetY: (o.back - o.front) / 2,
  };
}

/** Stable cache-key fragment; `'0'` when there is no overhang. */
export function overhangKey(o: ResolvedOverhang): string {
  if (!hasOverhang(o)) return '0';
  const q = (n: number): number => Math.round(n * 100) / 100;
  return `${q(o.left)},${q(o.right)},${q(o.front)},${q(o.back)},${o.feet ? 'f' : ''}`;
}
