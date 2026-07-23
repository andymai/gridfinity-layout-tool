/**
 * Shared helpers for kumiko vertex fillings.
 *
 * Fillings are authored as base segments in vertex-local (u, z) coordinates
 * with the jigumi arms at 30°/90°/150°/210°/270°/330°, then replicated by
 * 60° rotations — mirroring how traditional kumiko infill pieces repeat
 * around each three-way joint.
 *
 * Pure-math module — NO brepjs imports.
 */

import type { KumikoSegment } from './types';

/** A filling segment in vertex-local coordinates (mm). */
export interface LocalSegment {
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
  readonly width?: number;
}

const DEG_TO_RAD = Math.PI / 180;

function rotatePoint(p: readonly [number, number], deg: number): readonly [number, number] {
  const rad = deg * DEG_TO_RAD;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

/** Replicate base segments around the origin at the given rotation steps. */
export function replicateRotations(
  base: readonly LocalSegment[],
  rotationsDeg: readonly number[]
): KumikoSegment[] {
  const out: KumikoSegment[] = [];
  for (const deg of rotationsDeg) {
    for (const seg of base) {
      const a = rotatePoint(seg.a, deg);
      const b = rotatePoint(seg.b, deg);
      out.push(seg.width === undefined ? { a, b } : { a, b, width: seg.width });
    }
  }
  return out;
}

/** The six 60°-step rotations used by every hexagonally-symmetric filling. */
export const SIX_FOLD: readonly number[] = [0, 60, 120, 180, 240, 300];

/**
 * Alternate-arm rotations for fillings whose pieces span a whole arm: arms
 * are shared between two vertices, so six-fold replication would duplicate
 * every piece at exactly-coincident coordinates. Covering every OTHER arm
 * leaves the remaining three to the neighboring vertices — complete coverage
 * with no duplicates, and the set stays closed under 120° rotation.
 */
export const THREE_FOLD: readonly number[] = [0, 120, 240];
