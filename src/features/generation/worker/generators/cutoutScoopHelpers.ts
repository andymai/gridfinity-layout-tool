/**
 * Pure helpers for split-axis cutout scoop fillets.
 *
 * Kept separate from cutoutBuilder so the file stays under the 500-line lint
 * cap and the axis-classification math can be tested in isolation.
 */

import type { Cutout, CutoutScoopEdges } from '@/shared/types/bin';
import { DEFAULT_SCOOP_EDGES } from '@/shared/types/bin';

/**
 * Resolved scoop radii for a cutout, clamped to geometric limits.
 *
 * For circles and paths, W and D are forced equal — split-axis is meaningful
 * only for rectangles where the four bottom edges have distinct orientation.
 */
export interface ResolvedScoop {
  readonly w: number;
  readonly d: number;
  readonly edges: CutoutScoopEdges;
}

/** Resolve a cutout's scoop config into clamped radii + edge flags. */
export function resolveScoop(cutout: Cutout, effectiveDepth: number): ResolvedScoop {
  const maxScoop = Math.min(effectiveDepth, Math.min(cutout.width, cutout.depth) / 2) - 0.01;
  const cap = Math.max(0, maxScoop);
  const rawW = cutout.scoopRadiusW ?? 0;
  const rawD = cutout.scoopRadiusD ?? 0;
  if (cutout.shape !== 'rectangle') {
    const uniform = Math.min(Math.max(rawW, rawD), cap);
    return { w: uniform, d: uniform, edges: DEFAULT_SCOOP_EDGES };
  }
  return {
    w: Math.min(rawW, cap),
    d: Math.min(rawD, cap),
    edges: cutout.scoopEdges ?? DEFAULT_SCOOP_EDGES,
  };
}

/** Max axis radius across owner members; falls back to targetRadius when scoops aren't provided. */
export function maxOwnerAxisRadius(
  owners: readonly number[],
  memberScoops: readonly ResolvedScoop[] | undefined,
  targetRadius: number
): number {
  if (!memberScoops) return targetRadius;
  let max = 0;
  for (const i of owners) {
    const s = memberScoops[i];
    if (s.w > max) max = s.w;
    if (s.d > max) max = s.d;
  }
  return max;
}

/**
 * Pick the axis-specific radius for an edge owned by a single member.
 * Rotates the edge direction by -member.rotation to canonical frame and compares.
 */
export function classifyAxisRadius(
  edgeBounds: { xMin: number; xMax: number; yMin: number; yMax: number },
  member: Cutout,
  scoop: ResolvedScoop
): number {
  const dx = edgeBounds.xMax - edgeBounds.xMin;
  const dy = edgeBounds.yMax - edgeBounds.yMin;
  if (member.rotation === 0) {
    if (dy > dx) return scoop.w;
    if (dx > dy) return scoop.d;
    return Math.max(scoop.w, scoop.d);
  }
  const angle = (-member.rotation * Math.PI) / 180;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const localDX = Math.abs(dx * cosA - dy * sinA);
  const localDY = Math.abs(dx * sinA + dy * cosA);
  if (localDY > localDX) return scoop.w;
  if (localDX > localDY) return scoop.d;
  return Math.max(scoop.w, scoop.d);
}
