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

import type { OverhangConfig, WallTaperConfig } from '@/shared/types/bin';
import type { WallTaperProfile } from '@/core/types';

/**
 * Resolved outer-wall taper (#2933): per-side base inset already clamped to that
 * side's overhang; `bandHeight` still needs clamping to the wall height by the
 * box builder (the only caller that knows it).
 */
export interface ResolvedTaper {
  readonly profile: WallTaperProfile;
  readonly bandHeight: number;
  readonly left: number;
  readonly right: number;
  readonly front: number;
  readonly back: number;
}

/** Outward-only (>= 0) per-side overhang, with no undefined fields. */
export interface ResolvedOverhang {
  readonly left: number;
  readonly right: number;
  readonly front: number;
  readonly back: number;
  /** Add grid-aligned feet under the overhang region (default false). */
  readonly feet: boolean;
  /** Resolved outer-wall taper, or null when none applies. */
  readonly taper: ResolvedTaper | null;
}

const ZERO: ResolvedOverhang = {
  left: 0,
  right: 0,
  front: 0,
  back: 0,
  feet: false,
  taper: null,
};

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

/** Clamp a `WallTaperConfig` to per-side ≤ overhang, outward-only; null when none. */
function resolveTaper(
  taper: WallTaperConfig | undefined,
  overhang: { left: number; right: number; front: number; back: number }
): ResolvedTaper | null {
  if (!taper || taper.enabled === false) return null;
  const clamp = (v: number, max: number): number => Math.min(Math.max(0, v), max);
  const left = clamp(taper.left, overhang.left);
  const right = clamp(taper.right, overhang.right);
  const front = clamp(taper.front, overhang.front);
  const back = clamp(taper.back, overhang.back);
  const bandHeight = Math.max(0, taper.bandHeight);
  const noInset = left <= 1e-6 && right <= 1e-6 && front <= 1e-6 && back <= 1e-6;
  if (bandHeight <= 1e-6 || noInset) return null;
  return { profile: taper.profile, bandHeight, left, right, front, back };
}

/** Clamp an `OverhangConfig` to outward-only values; absent → all zero. */
export function resolveOverhang(overhang: OverhangConfig | undefined): ResolvedOverhang {
  if (!overhang) return ZERO;
  if (overhang.enabled === false) return ZERO;
  const left = Math.max(0, overhang.left);
  const right = Math.max(0, overhang.right);
  const front = Math.max(0, overhang.front);
  const back = Math.max(0, overhang.back);
  const feet = overhang.feet ?? false;
  return {
    left,
    right,
    front,
    back,
    feet,
    taper: resolveTaper(overhang.taper, { left, right, front, back }),
  };
}

/** True when any side has a non-trivial outward expansion. */
export function hasOverhang(o: ResolvedOverhang): boolean {
  return o.left > 1e-6 || o.right > 1e-6 || o.front > 1e-6 || o.back > 1e-6;
}

/** True when a resolved outer-wall taper applies. */
export function hasTaper(o: ResolvedOverhang): boolean {
  return o.taper !== null;
}

/**
 * Per-side overhang at the *base* rather than the rim: the taper's inset
 * removed. Anything that sits under the bin — overhang feet above all — has to
 * be framed from this, not from the rim values, or it protrudes past a tapered
 * wall into open air.
 */
export function overhangBaseSides(o: ResolvedOverhang): {
  left: number;
  right: number;
  front: number;
  back: number;
} {
  const t = o.taper;
  if (!t) return { left: o.left, right: o.right, front: o.front, back: o.back };
  return {
    left: Math.max(0, o.left - t.left),
    right: Math.max(0, o.right - t.right),
    front: Math.max(0, o.front - t.front),
    back: Math.max(0, o.back - t.back),
  };
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
  const base = `${q(o.left)},${q(o.right)},${q(o.front)},${q(o.back)},${o.feet ? 'f' : ''}`;
  // Taper requires overhang (per-side inset is clamped to overhang), so it can
  // only appear alongside a non-zero base — but it must still key the cache.
  if (!o.taper) return base;
  const t = o.taper;
  return `${base};t:${t.profile[0]},${q(t.bandHeight)},${q(t.left)},${q(t.right)},${q(t.front)},${q(t.back)}`;
}
