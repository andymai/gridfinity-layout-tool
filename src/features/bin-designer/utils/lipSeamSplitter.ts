/**
 * Split lip triangles along the active color-grid seam planes so every
 * color boundary is geometrically exact (no triangle-quantized zigzag).
 *
 * The lip is partitioned by XY corner quadrant × Z height band. Each lip
 * triangle is clipped against the active planes (`y=cy` front/back, `x=cx`
 * left/right, and the band `z` planes) into sub-triangles that each lie
 * wholly in one cell; non-lip triangles pass through unchanged. The result
 * is a flat (non-indexed) position buffer plus a per-output-triangle zone
 * array — the single source of truth shared by the 3D preview and the 3MF
 * exporter, so they color identically.
 *
 * Pure: no Three.js / DOM. Format-agnostic via a `getTriangle` accessor.
 */

import { FeatureTag } from '@/shared/types/generation';
import type { FaceGroupData } from '@/shared/types/generation';
import { classifyLipCell, type LipGeom } from './lipCornerClassifier';
import { featureTagToColorZone } from '../types/featureColors';
import type { ColorZone, LipAxisCount } from '../types/featureColors';

/** Flat triangle: [x0,y0,z0, x1,y1,z1, x2,y2,z2]. */
type Tri = readonly number[];
type Vec3 = readonly [number, number, number];

export interface LipSplitInput {
  readonly triangleCount: number;
  readonly faceGroups: readonly FaceGroupData[];
  /** Returns the 9 position floats of triangle `i` (in triangle order). */
  readonly getTriangle: (i: number) => Tri;
  /** Lip footprint geometry, or null when the bin has no stacking lip (a
   *  top-accent-only cut still needs to run). */
  readonly geom: LipGeom | null;
  readonly counts: { readonly corners: LipAxisCount; readonly bands: LipAxisCount };
  /** Clip LIP triangles along the quadrant×band seam planes. Defaults to true
   *  (the historic behavior); pass false when only the top-accent cut applies. */
  readonly splitLipGrid?: boolean;
  /** Horizontal cut plane: geometry with a centroid above this Z becomes the
   *  top-accent zone, overriding every other zone. Null disables the cut. */
  readonly topAccentCutZ?: number | null;
}

export interface LipSplitResult {
  /** Flat non-indexed positions, 9 floats per output triangle. */
  readonly positions: Float32Array;
  /** Flat per-triangle face normals, parallel to `positions`. */
  readonly normals: Float32Array;
  /** Zone of each output triangle (lip cells + non-lip zones). */
  readonly triZones: ColorZone[];
  /** Source FeatureTag of each output triangle (lip pieces report LIP). Lets
   *  a later pass attribute cutout-tagged triangles to their color unit. */
  readonly triTags: Int32Array;
}

const EPS = 1e-7;

/** Flat per-triangle face normals (same normal repeated for the 3 verts). */
export function faceNormals(positions: Float32Array): Float32Array {
  const out = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 9) {
    const ux = positions[i + 3] - positions[i];
    const uy = positions[i + 4] - positions[i + 1];
    const uz = positions[i + 5] - positions[i + 2];
    const vx = positions[i + 6] - positions[i];
    const vy = positions[i + 7] - positions[i + 1];
    const vz = positions[i + 8] - positions[i + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (let v = 0; v < 3; v++) {
      out[i + v * 3] = nx;
      out[i + v * 3 + 1] = ny;
      out[i + v * 3 + 2] = nz;
    }
  }
  return out;
}

/** Per-triangle FeatureTag lookup from face group ranges. */
function buildTriTags(faceGroups: readonly FaceGroupData[], triangleCount: number): Int32Array {
  const tags = new Int32Array(triangleCount).fill(FeatureTag.UNKNOWN);
  for (const g of faceGroups) {
    const start = g.start / 3;
    const end = start + g.count / 3;
    for (let i = start; i < end && i < triangleCount; i++) tags[i] = g.tag;
  }
  return tags;
}

/** Clip a convex polygon to one side of an axis-aligned plane (Sutherland-Hodgman). */
function clipHalfspace(
  poly: readonly Vec3[],
  axis: 0 | 1 | 2,
  c: number,
  keepBelow: boolean
): Vec3[] {
  const out: Vec3[] = [];
  // Complementary at the boundary so the below/above halves partition the
  // polygon rather than overlap: a point on the plane belongs to "below" only.
  // An inclusive slab on both sides would emit an on-seam triangle in BOTH
  // halves, duplicating geometry and inflating area.
  const inside = (p: Vec3) => (keepBelow ? p[axis] <= c + EPS : p[axis] > c + EPS);
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const next = poly[(i + 1) % poly.length];
    const curIn = inside(cur);
    const nextIn = inside(next);
    if (curIn) out.push(cur);
    if (curIn !== nextIn) {
      const denom = next[axis] - cur[axis];
      // Parallel-to-plane edge can't cross; skip (denom≈0 only when both ~on plane).
      if (Math.abs(denom) > EPS) {
        const t = (c - cur[axis]) / denom;
        out.push([
          cur[0] + (next[0] - cur[0]) * t,
          cur[1] + (next[1] - cur[1]) * t,
          cur[2] + (next[2] - cur[2]) * t,
        ]);
      }
    }
  }
  return out;
}

/** Fan-triangulate a convex polygon into flat triangles, dropping degenerates. */
function fanTriangulate(poly: readonly Vec3[], out: number[][]): void {
  if (poly.length < 3) return;
  for (let i = 1; i + 1 < poly.length; i++) {
    const a = poly[0];
    const b = poly[i];
    const c = poly[i + 1];
    // Drop ~zero-area slivers (cross-product magnitude).
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2];
    const vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2];
    const cxp = uy * vz - uz * vy;
    const cyp = uz * vx - ux * vz;
    const czp = ux * vy - uy * vx;
    if (cxp * cxp + cyp * cyp + czp * czp < EPS * EPS) continue;
    out.push([a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]]);
  }
}

/** Split a set of triangles by one axis-aligned plane into below/above pieces. */
function splitByPlane(tris: readonly number[][], axis: 0 | 1 | 2, c: number): number[][] {
  const out: number[][] = [];
  for (const t of tris) {
    const poly: Vec3[] = [
      [t[0], t[1], t[2]],
      [t[3], t[4], t[5]],
      [t[6], t[7], t[8]],
    ];
    fanTriangulate(clipHalfspace(poly, axis, c, true), out);
    fanTriangulate(clipHalfspace(poly, axis, c, false), out);
  }
  return out;
}

/** Active seam planes for the grid: corner quadrants + band heights. */
function seamPlanes(
  geom: LipGeom,
  counts: { corners: LipAxisCount; bands: LipAxisCount }
): { axis: 0 | 1 | 2; c: number }[] {
  const planes: { axis: 0 | 1 | 2; c: number }[] = [];
  // corners: 2 → front/back (y); 4 → also left/right (x).
  if (counts.corners >= 2) planes.push({ axis: 1, c: geom.cy });
  if (counts.corners === 4) planes.push({ axis: 0, c: geom.cx });
  // bands: interior horizontal planes.
  if (counts.bands >= 2 && geom.maxZ > geom.minZ) {
    const step = (geom.maxZ - geom.minZ) / counts.bands;
    for (let k = 1; k < counts.bands; k++) planes.push({ axis: 2, c: geom.minZ + k * step });
  }
  return planes;
}

/**
 * Build the split mesh. Lip triangles are clipped along the seam planes; when a
 * top-accent cut is active, every triangle is additionally clipped at that Z
 * plane. Each sub-triangle is classified by its centroid: above the cut →
 * top-accent (wins over all zones), otherwise its lip cell (lip triangles) or
 * feature-tag zone. Returns a flat position buffer + per-output triangle zones.
 */
export function splitLipMesh(input: LipSplitInput): LipSplitResult {
  const { triangleCount, faceGroups, getTriangle, geom, counts } = input;
  const splitLipGrid = input.splitLipGrid ?? true;
  const cutZ = input.topAccentCutZ ?? null;
  const tags = buildTriTags(faceGroups, triangleCount);
  const lipPlanes = geom && splitLipGrid ? seamPlanes(geom, counts) : [];

  const positions: number[] = [];
  const triZones: ColorZone[] = [];
  const triTags: number[] = [];

  for (let i = 0; i < triangleCount; i++) {
    const tag = tags[i];
    const isLip = tag === FeatureTag.LIP && geom !== null;

    // Clip through the applicable planes: lip seams (lip triangles only) plus
    // the top-accent Z plane (every triangle). A triangle wholly on one side of
    // a plane passes through as a single piece, so non-straddling geometry is
    // not fragmented.
    let pieces: number[][] = [Array.from(getTriangle(i))];
    if (isLip) for (const p of lipPlanes) pieces = splitByPlane(pieces, p.axis, p.c);
    if (cutZ !== null) pieces = splitByPlane(pieces, 2, cutZ);

    for (const piece of pieces) {
      const cxp = (piece[0] + piece[3] + piece[6]) / 3;
      const cyp = (piece[1] + piece[4] + piece[7]) / 3;
      const czp = (piece[2] + piece[5] + piece[8]) / 3;
      positions.push(...piece);
      if (cutZ !== null && czp > cutZ) {
        triZones.push('topAccent');
      } else if (isLip) {
        triZones.push(classifyLipCell(cxp, cyp, czp, geom, counts));
      } else {
        triZones.push(featureTagToColorZone(tag) ?? 'body');
      }
      triTags.push(tag);
    }
  }

  const pos = new Float32Array(positions);
  return { positions: pos, normals: faceNormals(pos), triZones, triTags: Int32Array.from(triTags) };
}

/** True when the grid actually partitions the lip (otherwise skip splitting). */
export function lipGridIsNonTrivial(counts: {
  corners: LipAxisCount;
  bands: LipAxisCount;
}): boolean {
  return counts.corners > 1 || counts.bands > 1;
}

/**
 * Single source of truth for lip color assignment, shared by the preview
 * (`buildMultiColorGroups`) and the 3MF exporter (`materialMapping`).
 *
 * - Non-trivial grid with differing cell colors: re-tessellate the lip via
 *   {@link splitLipMesh} → returns new flat `positions` plus per-output zones.
 * - Trivial grid, no lip, or a non-trivial grid whose active cells all share
 *   one color (`lipUniform`): classify each input triangle in place →
 *   `positions` is null (caller keeps its original geometry). Splitting a
 *   uniform grid only adds avoidable CPU/memory — there are no seams to honor.
 *
 * Both callers feed the same `getTriangle`/`geom`/`counts`, so the resulting
 * `triZones` (and therefore colors) are identical across preview and export.
 */
export function computeLipColoredMesh(input: {
  readonly triangleCount: number;
  readonly faceGroups: readonly FaceGroupData[];
  readonly getTriangle: (i: number) => Tri;
  readonly geom: LipGeom | null;
  readonly counts: { readonly corners: LipAxisCount; readonly bands: LipAxisCount };
  readonly lipUniform?: boolean;
  /** Top-accent cut plane (see {@link LipSplitInput}). Null = no top accent. */
  readonly topAccentCutZ?: number | null;
  /**
   * Whether re-tessellation is permitted. The hit-test path passes false so the
   * returned `triZones` stays 1:1 with the input triangles (it maps a clicked
   * original-triangle index back to a zone); it accepts centroid-quantized
   * boundaries in exchange. Defaults to true.
   */
  readonly allowSplit?: boolean;
}): {
  triZones: ColorZone[];
  positions: Float32Array | null;
  normals: Float32Array | null;
  triTags: Int32Array;
} {
  const { triangleCount, faceGroups, getTriangle, geom, counts, lipUniform } = input;
  const cutZ = input.topAccentCutZ ?? null;
  const allowSplit = input.allowSplit ?? true;
  const splitLipGrid = !!geom && lipGridIsNonTrivial(counts) && !lipUniform;

  // Re-tessellate when there are exact color boundaries to honor: a non-uniform
  // lip grid, or a top-accent cut (which slices every triangle at its Z plane).
  if (allowSplit && (splitLipGrid || cutZ !== null)) {
    const r = splitLipMesh({
      triangleCount,
      faceGroups,
      getTriangle,
      geom,
      counts,
      splitLipGrid,
      topAccentCutZ: cutZ,
    });
    return { triZones: r.triZones, positions: r.positions, normals: r.normals, triTags: r.triTags };
  }

  const tags = buildTriTags(faceGroups, triangleCount);
  const triZones: ColorZone[] = new Array<ColorZone>(triangleCount);
  for (let i = 0; i < triangleCount; i++) {
    const tag = tags[i];
    const isLip = tag === FeatureTag.LIP && geom !== null;
    if (cutZ === null && !isLip) {
      triZones[i] = featureTagToColorZone(tag) ?? 'body';
      continue;
    }
    const t = getTriangle(i);
    const cz = (t[2] + t[5] + t[8]) / 3;
    if (cutZ !== null && cz > cutZ) {
      triZones[i] = 'topAccent';
    } else if (isLip) {
      const cx = (t[0] + t[3] + t[6]) / 3;
      const cy = (t[1] + t[4] + t[7]) / 3;
      triZones[i] = classifyLipCell(cx, cy, cz, geom, counts);
    } else {
      triZones[i] = featureTagToColorZone(tag) ?? 'body';
    }
  }
  // In-place path keeps the original mesh; tags align 1:1 with input triangles.
  return { triZones, positions: null, normals: null, triTags: tags };
}
