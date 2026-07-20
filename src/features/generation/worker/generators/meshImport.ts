/**
 * STL → MeshAsset import pipeline (worker-side).
 *
 * parse → weld/merge (repair) → manifold-check → auto lay-flat → user rotation →
 * decimate to budget → silhouette outlines → quantize+compress.
 *
 * Runs on the raw manifold-3d module (independent of the worker's brepjs
 * kernel): mesh CSG needs watertight input, which is exactly what this
 * pipeline validates and normalizes for the later imprint subtract.
 */

import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d';
import { err, isErr, ok } from '@/core/result';
import type { Result } from '@/core/result';
import { parseSTL } from '@/shared/generation/stlParser';
import {
  encodeMeshData,
  MAX_MESH_ASSET_TRIANGLES,
  MAX_MESH_FILE_BYTES,
  MAX_MESH_OUTLINE_POINTS,
} from '@/shared/generation/meshAsset';
import type {
  MeshAsset,
  MeshImportErrorReason,
  MeshImportRotation,
  MeshOutlinePoint,
} from '@/shared/generation/meshAsset';
import { simplifyRdp } from '@/shared/scanTrace/simplify';
import { getManifoldModule } from '../manifoldRuntime';

export interface MeshImportError {
  readonly reason: MeshImportErrorReason;
  readonly message: string;
}

export interface MeshImportResult {
  readonly asset: MeshAsset;
  /** Decimated, oriented, origin-normalized mesh for the preview dialog. */
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  /** Default pocket depth: the oriented mesh height (mm). */
  readonly suggestedCutDepth: number;
  /** Solid volume in mm³ of the oriented manifold; powers filament estimates
   *  for whole-bin imports. */
  readonly volumeMm3: number;
}

/**
 * Candidate "which face is down" rotations for lay-flat: the 6 axis-aligned
 * down-faces. Z-spins are omitted — they never change height and the user
 * rotates the footprint freely in the 2D editor anyway.
 */
const LAY_FLAT_CANDIDATES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [180, 0, 0],
  [90, 0, 0],
  [270, 0, 0],
  [0, 90, 0],
  [0, 270, 0],
];

const DECIMATE_TOLERANCES_MM = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2] as const;
const OUTLINE_EPSILON_MM = 0.05;
/** Simplification stops coarsening here so a detailed silhouette is never
 *  crushed to a blob just to fit its budget share — overflow is resolved by
 *  dropping the smallest rings instead. */
const OUTLINE_EPSILON_SOFT_MAX_MM = 0.5;
/** Last-resort ceiling when a single ring alone overflows the total cap. */
const OUTLINE_EPSILON_HARD_MAX_MM = 5;
/** Rings below this share of the largest ring's area are scan-noise specks… */
const SPECK_RELATIVE_AREA = 0.002;
/** …unless they clear this absolute area — a real small feature (a 3mm probe
 *  tip) must survive no matter how large the tool it belongs to. */
const SPECK_KEEP_AREA_MM2 = 4;
/** Floor of the shared point budget per kept ring, so small real features
 *  stay round-ish instead of collapsing to triangles. */
const MIN_RING_BUDGET = 16;

function sanitizeName(fileName: string): string {
  return (
    fileName
      .replace(/\.(stl)$/i, '')
      // eslint-disable-next-line no-control-regex -- strip control chars from user file names
      .replace(/[\x00-\x1f\x7f]/g, '')
      .trim()
      .slice(0, 64) || 'imported-mesh'
  );
}

function signedArea(ring: ReadonlyArray<readonly [number, number]>): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function ringPerimeter(ring: ReadonlyArray<MeshOutlinePoint>): number {
  let length = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return length;
}

/** Epsilon ladder from {@link OUTLINE_EPSILON_MM}, doubling while the ring is
 *  over budget — but never past the soft cap: fidelity beats budget share. */
function simplifyRingToBudget(
  ring: ReadonlyArray<MeshOutlinePoint>,
  budget: number
): MeshOutlinePoint[] {
  let epsilon = OUTLINE_EPSILON_MM;
  let out = simplifyRdp(ring, epsilon);
  while (out.length > budget && epsilon < OUTLINE_EPSILON_SOFT_MAX_MM) {
    epsilon = Math.min(epsilon * 2, OUTLINE_EPSILON_SOFT_MAX_MM);
    out = simplifyRdp(ring, epsilon);
  }
  return out;
}

/**
 * Extract simplified outer silhouette rings from the oriented manifold.
 * Holes (negative-area rings) are dropped: the footprint, clearance offset,
 * and chamfer rim all operate on the insertion opening, which is the outer
 * boundary.
 *
 * Scanned meshes project with speck rings (noise islands) and dense, noisy
 * contours, so the point cap is enforced without sacrificing the outline the
 * user actually cares about: specks are filtered by area first, the shared
 * budget is split across the surviving rings by perimeter, and each ring's
 * epsilon stops coarsening at a soft cap. If the total still overflows, the
 * smallest rings are dropped whole — never the main outline's detail.
 */
function extractOutlines(oriented: Manifold): MeshOutlinePoint[][] {
  const projected: CrossSection = oriented.project();
  try {
    const simplified = projected.simplify(0.02);
    try {
      const outer = simplified
        .toPolygons()
        .map((ring) => ({ ring, area: signedArea(ring) }))
        .filter(({ area }) => area > 0);
      if (outer.length === 0) return [];

      const largestArea = outer.reduce((max, { area }) => (area > max ? area : max), 0);
      const speckThreshold = Math.min(largestArea * SPECK_RELATIVE_AREA, SPECK_KEEP_AREA_MM2);
      const kept = outer
        .filter(({ area }) => area >= speckThreshold)
        .sort((a, b) => b.area - a.area)
        .map(({ ring }) => ring.map(([x, y]): MeshOutlinePoint => ({ x, y })));

      const perimeters = kept.map(ringPerimeter);
      const totalPerimeter = perimeters.reduce((sum, length) => sum + length, 0);
      let outlines = kept.map((ring, i) => {
        const share = totalPerimeter > 0 ? perimeters[i] / totalPerimeter : 0;
        const budget = Math.max(MIN_RING_BUDGET, Math.floor(MAX_MESH_OUTLINE_POINTS * share));
        return simplifyRingToBudget(ring, budget);
      });

      const total = (): number => outlines.reduce((sum, ring) => sum + ring.length, 0);
      while (outlines.length > 1 && total() > MAX_MESH_OUTLINE_POINTS) outlines.pop();
      let epsilon = OUTLINE_EPSILON_SOFT_MAX_MM;
      while (total() > MAX_MESH_OUTLINE_POINTS && epsilon < OUTLINE_EPSILON_HARD_MAX_MM) {
        epsilon = Math.min(epsilon * 2, OUTLINE_EPSILON_HARD_MAX_MM);
        outlines = [simplifyRdp(kept[0], epsilon)];
      }
      return outlines.filter((ring) => ring.length >= 3);
    } finally {
      simplified.delete();
    }
  } finally {
    projected.delete();
  }
}

function orientationScore(candidate: Manifold): { height: number; footprint: number } {
  const box = candidate.boundingBox();
  return {
    height: box.max[2] - box.min[2],
    footprint: (box.max[0] - box.min[0]) * (box.max[1] - box.min[1]),
  };
}

/** Pick the lay-flat rotation: minimal height, tie-broken by max footprint. */
function pickLayFlatRotation(manifold: Manifold): readonly [number, number, number] {
  let best: readonly [number, number, number] = LAY_FLAT_CANDIDATES[0];
  let bestHeight = Infinity;
  let bestFootprint = -Infinity;
  const HEIGHT_TIE_MM = 1e-6;
  for (const rotation of LAY_FLAT_CANDIDATES) {
    const rotated = manifold.rotate([...rotation]);
    try {
      const { height, footprint } = orientationScore(rotated);
      if (
        height < bestHeight - HEIGHT_TIE_MM ||
        (Math.abs(height - bestHeight) <= HEIGHT_TIE_MM && footprint > bestFootprint)
      ) {
        best = rotation;
        bestHeight = height;
        bestFootprint = footprint;
      }
    } finally {
      rotated.delete();
    }
  }
  return best;
}

/** Decimate to the triangle budget by walking a tolerance ladder. */
function decimateToBudget(manifold: Manifold): Manifold | null {
  if (manifold.numTri() <= MAX_MESH_ASSET_TRIANGLES) return manifold;
  for (const tolerance of DECIMATE_TOLERANCES_MM) {
    const simplified = manifold.simplify(tolerance);
    if (simplified.numTri() <= MAX_MESH_ASSET_TRIANGLES) {
      manifold.delete();
      return simplified;
    }
    simplified.delete();
  }
  return null;
}

/**
 * Full import: STL buffer → compressed MeshAsset + preview arrays.
 *
 * `rotation` (degrees per axis, any angle) composes AFTER the deterministic
 * auto lay-flat, so re-running with a different rotation is stable (the auto
 * orientation never changes for a given file).
 */
export async function importMeshFromStl(
  buffer: ArrayBuffer,
  fileName: string,
  rotation: MeshImportRotation = { x: 0, y: 0, z: 0 },
  // Node tests inject an fs-instantiated module; the worker's fetch-based
  // loader can't run outside the browser.
  moduleOverride?: ManifoldToplevel
): Promise<Result<MeshImportResult, MeshImportError>> {
  if (buffer.byteLength > MAX_MESH_FILE_BYTES) {
    return err({
      reason: 'too_large',
      message: `File is ${Math.round(buffer.byteLength / 1024 / 1024)}MB (max ${MAX_MESH_FILE_BYTES / 1024 / 1024}MB)`,
    });
  }

  const parsed = parseSTL(buffer);
  if (isErr(parsed)) {
    return err({ reason: 'parse_failed', message: parsed.error.message });
  }
  if (parsed.value.vertices.length === 0) {
    return err({ reason: 'empty', message: 'STL contains no triangles' });
  }

  const module: ManifoldToplevel = moduleOverride ?? (await getManifoldModule());

  const soupVertexCount = parsed.value.vertices.length / 3;
  const triVerts = new Uint32Array(soupVertexCount);
  for (let i = 0; i < soupVertexCount; i++) triVerts[i] = i;
  const inputMesh = new module.Mesh({
    numProp: 3,
    vertProperties: parsed.value.vertices,
    triVerts,
  });
  inputMesh.merge();

  let solid: Manifold;
  try {
    solid = new module.Manifold(inputMesh);
  } catch {
    return err({
      reason: 'not_manifold',
      message:
        'Mesh is not watertight (has holes or self-intersections) — try repairing it in your slicer, then re-export',
    });
  }

  let oriented: Manifold | null = null;
  try {
    const decimated = decimateToBudget(solid);
    if (decimated === null) {
      return err({
        reason: 'too_large',
        message: `Mesh is too complex to simplify below ${MAX_MESH_ASSET_TRIANGLES} triangles`,
      });
    }
    // decimateToBudget consumed `solid` if it returned a new manifold
    solid = decimated;

    const layFlat = pickLayFlatRotation(solid);
    const normalizeDeg = (deg: number): number =>
      Number.isFinite(deg) ? ((deg % 360) + 360) % 360 : 0;
    const userRotation: readonly [number, number, number] = [
      normalizeDeg(rotation.x),
      normalizeDeg(rotation.y),
      normalizeDeg(rotation.z),
    ];
    const laid = solid.rotate([...layFlat]);
    const rotated = laid.rotate([...userRotation]);
    laid.delete();

    const box = rotated.boundingBox();
    oriented = rotated.translate([-box.min[0], -box.min[1], -box.min[2]]);
    rotated.delete();

    const finalBox = oriented.boundingBox();
    const sizeMm = {
      x: finalBox.max[0],
      y: finalBox.max[1],
      z: finalBox.max[2],
    };

    const outlines = extractOutlines(oriented);
    if (outlines.length === 0) {
      return err({ reason: 'empty', message: 'Mesh has no projected footprint' });
    }

    const outputMesh = oriented.getMesh();
    const positions =
      outputMesh.numProp === 3
        ? outputMesh.vertProperties
        : extractPositions(outputMesh.vertProperties, outputMesh.numProp);
    const indices = outputMesh.triVerts;

    const encoded = await encodeMeshData(positions, indices);
    if (isErr(encoded)) {
      return err({ reason: 'parse_failed', message: encoded.error.message });
    }

    const asset: MeshAsset = {
      name: sanitizeName(fileName),
      data: encoded.value,
      triangleCount: oriented.numTri(),
      sizeMm,
      outlines,
    };

    return ok({
      asset,
      positions,
      indices,
      suggestedCutDepth: sizeMm.z,
      volumeMm3: oriented.volume(),
    });
  } finally {
    solid.delete();
    oriented?.delete();
  }
}

function extractPositions(vertProperties: Float32Array, numProp: number): Float32Array {
  const vertexCount = vertProperties.length / numProp;
  const positions = new Float32Array(vertexCount * 3);
  for (let v = 0; v < vertexCount; v++) {
    positions[v * 3] = vertProperties[v * numProp];
    positions[v * 3 + 1] = vertProperties[v * numProp + 1];
    positions[v * 3 + 2] = vertProperties[v * numProp + 2];
  }
  return positions;
}
