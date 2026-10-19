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

/** Max axis radius across the given owner indices. */
export function maxOwnerAxisRadius(
  owners: readonly number[],
  memberScoops: readonly ResolvedScoop[]
): number {
  let max = 0;
  for (const i of owners) {
    const s = memberScoops[i];
    if (s.w > max) max = s.w;
    if (s.d > max) max = s.d;
  }
  return max;
}

/**
 * Pick the axis-specific radius for an edge owned by a single grouped member.
 *
 * Classifies by the edge midpoint's position in the member's local frame
 * (not by bounding-box extents, which lose sign for non-orthogonal rotations
 * and incorrectly collapse W- and D-axis edges to the same axis).
 *
 * In the member's local frame, an edge on a W-wall (left/right) has its
 * midpoint near x = ±halfW with |localX| > |localY|; an edge on a D-wall
 * (front/back) has its midpoint near y = ±halfD with |localY| > |localX|;
 * corner-arc midpoints sit near (±halfW, ±halfD) and fall back to max(W, D).
 *
 * Edge gates (`scoop.edges.{left,right,front,back}`) are also honored:
 * returns 0 for edges whose corresponding gate is off.
 */
export function classifyAxisRadius(
  edgeBounds: { xMin: number; xMax: number; yMin: number; yMax: number },
  member: Cutout,
  scoop: ResolvedScoop,
  memberCenter: { readonly x: number; readonly y: number }
): number {
  const worldMidX = (edgeBounds.xMin + edgeBounds.xMax) / 2;
  const worldMidY = (edgeBounds.yMin + edgeBounds.yMax) / 2;
  const dx = worldMidX - memberCenter.x;
  const dy = worldMidY - memberCenter.y;

  // Shapes are rotated by -member.rotation in buildCutoutShape, so inverting
  // (world → local) means rotating by +member.rotation.
  const angle = (member.rotation * Math.PI) / 180;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const localX = dx * cosA - dy * sinA;
  const localY = dx * sinA + dy * cosA;

  const halfW = member.width / 2;
  const halfD = member.depth / 2;
  // 0.5mm tolerance — picks up rounded-rect arcs whose midpoint sits slightly
  // inside the wall extents (their midpoint is at the corner).
  const tol = 0.5;
  const onWWall = Math.abs(Math.abs(localX) - halfW) < tol;
  const onDWall = Math.abs(Math.abs(localY) - halfD) < tol;

  if (onWWall && !onDWall) {
    // Wall gate: left wall has localX < 0, right wall has localX > 0
    if (localX < 0 ? !scoop.edges.left : !scoop.edges.right) return 0;
    return scoop.w;
  }
  if (onDWall && !onWWall) {
    if (localY < 0 ? !scoop.edges.front : !scoop.edges.back) return 0;
    return scoop.d;
  }
  // Corner arc (both walls) or unclassifiable — use larger axis, gated by
  // both adjacent edges (both must be enabled to round the corner).
  if (onWWall && onDWall) {
    const wAllowed = localX < 0 ? scoop.edges.left : scoop.edges.right;
    const dAllowed = localY < 0 ? scoop.edges.front : scoop.edges.back;
    if (!wAllowed || !dAllowed) return 0;
  }
  return Math.max(scoop.w, scoop.d);
}
