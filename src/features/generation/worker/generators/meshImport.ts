/**
 * STL → MeshAsset import pipeline (worker-side).
 *
 * parse → weld/merge (repair) → manifold-check → auto lay-flat → user flips →
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
  MeshImportFlips,
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

/**
 * Extract simplified outer silhouette rings from the oriented manifold.
 * Holes (negative-area rings) are dropped: the footprint, clearance offset,
 * and chamfer rim all operate on the insertion opening, which is the outer
 * boundary. Point count is capped by re-simplifying with a doubled epsilon.
 */
function extractOutlines(oriented: Manifold): MeshOutlinePoint[][] {
  const projected: CrossSection = oriented.project();
  try {
    const simplified = projected.simplify(0.02);
    try {
      const rings = simplified
        .toPolygons()
        .filter((ring) => signedArea(ring) > 0)
        .map((ring) => ring.map(([x, y]) => ({ x, y })));

      let epsilon = OUTLINE_EPSILON_MM;
      let outlines = rings.map((ring) => simplifyRdp(ring, epsilon));
      while (
        outlines.reduce((total, ring) => total + ring.length, 0) > MAX_MESH_OUTLINE_POINTS &&
        epsilon < 5
      ) {
        epsilon *= 2;
        outlines = rings.map((ring) => simplifyRdp(ring, epsilon));
      }
      return outlines;
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
 * `flips` compose AFTER the deterministic auto lay-flat, so re-running with
 * different flips is stable (the auto orientation never changes for a given
 * file).
 */
export async function importMeshFromStl(
  buffer: ArrayBuffer,
  fileName: string,
  flips: MeshImportFlips = { x: 0, y: 0, z: 0 },
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
    const flipRotation: readonly [number, number, number] = [
      (((flips.x % 4) + 4) % 4) * 90,
      (((flips.y % 4) + 4) % 4) * 90,
      (((flips.z % 4) + 4) % 4) * 90,
    ];
    const laid = solid.rotate([...layFlat]);
    const flipped = laid.rotate([...flipRotation]);
    laid.delete();

    const box = flipped.boundingBox();
    oriented = flipped.translate([-box.min[0], -box.min[1], -box.min[2]]);
    flipped.delete();

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

    return ok({ asset, positions, indices, suggestedCutDepth: sizeMm.z });
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
