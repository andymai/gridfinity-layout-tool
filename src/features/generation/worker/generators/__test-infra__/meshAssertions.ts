/**
 * Reusable mesh assertion helpers for bin generation tests.
 */
import { expect } from 'vitest';
import type { MeshData } from '@/features/generation/bridge/types';
import type { BinParams } from '@/shared/types/bin';
import { GRIDFINITY } from '@/shared/constants/bin';
import type { SplitPreviewResult } from './wasmInit';

// ─── Structural validity ─────────────────────────────────────────────────────

/** Assert a MeshData result has valid structure: vertices > 0, normals match, indices consistent, no NaN. */
export function assertStructurallyValid(result: MeshData, label?: string): void {
  const prefix = label ? `${label}: ` : '';
  expect(result.vertices.length, `${prefix}vertices should exist`).toBeGreaterThan(0);
  expect(result.normals.length, `${prefix}normals should match vertices`).toBe(
    result.vertices.length
  );
  expect(result.indices.length, `${prefix}indices should match triangleCount`).toBe(
    result.triangleCount * 3
  );
  expect(result.triangleCount, `${prefix}should have triangles`).toBeGreaterThan(0);
  expect(hasNoNaNOrInfinity(result.vertices), `${prefix}vertices have NaN/Infinity`).toBe(true);
  expect(hasNoNaNOrInfinity(result.normals), `${prefix}normals have NaN/Infinity`).toBe(true);
}

// ─── NaN / Infinity ──────────────────────────────────────────────────────────

/** Returns true if the Float32Array contains no NaN or Infinity values. */
export function hasNoNaNOrInfinity(arr: Float32Array): boolean {
  for (let i = 0; i < arr.length; i++) {
    if (!Number.isFinite(arr[i])) return false;
  }
  return true;
}

// ─── Bounding box ────────────────────────────────────────────────────────────

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export function boundingBox(vertices: Float32Array): BoundingBox {
  const bb: BoundingBox = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  for (let i = 0; i < vertices.length; i += 3) {
    bb.minX = Math.min(bb.minX, vertices[i]);
    bb.maxX = Math.max(bb.maxX, vertices[i]);
    bb.minY = Math.min(bb.minY, vertices[i + 1]);
    bb.maxY = Math.max(bb.maxY, vertices[i + 1]);
    bb.minZ = Math.min(bb.minZ, vertices[i + 2]);
    bb.maxZ = Math.max(bb.maxZ, vertices[i + 2]);
  }
  return bb;
}

// ─── Lip-wall vertex zone counting ──────────────────────────────────────────

interface WallVertexCounts {
  left: number;
  right: number;
  front: number;
  back: number;
  maxZ: number;
}

/**
 * Count vertices near each outer wall face within a Z-band.
 * Used by lip-wall regression tests (#781).
 */
export function countWallVerticesInZone(
  mesh: MeshData,
  outerW: number,
  outerD: number,
  zMin: number,
  zMax: number,
  proximity: number
): WallVertexCounts {
  let left = 0;
  let right = 0;
  let front = 0;
  let back = 0;
  let maxZ = -Infinity;

  for (let i = 0; i < mesh.vertices.length; i += 3) {
    const x = mesh.vertices[i];
    const y = mesh.vertices[i + 1];
    const z = mesh.vertices[i + 2];

    if (z > maxZ) maxZ = z;
    if (z < zMin || z > zMax) continue;

    if (Math.abs(x - -outerW / 2) < proximity) left++;
    if (Math.abs(x - outerW / 2) < proximity) right++;
    if (Math.abs(y - -outerD / 2) < proximity) front++;
    if (Math.abs(y - outerD / 2) < proximity) back++;
  }

  return { left, right, front, back, maxZ };
}

// ─── Split piece validation ─────────────────────────────────────────────────

const SIZE = GRIDFINITY.GRID_SIZE;
const CLEARANCE = GRIDFINITY.TOLERANCE;

/**
 * Assert that a split result is geometrically valid.
 * Checks piece count, vertex sanity, and bounding box dimensions.
 */
export function assertValidSplit(
  result: SplitPreviewResult,
  expectedPieces: number,
  params: BinParams,
  label: string
): void {
  expect(result.pieces, `${label}: piece count`).toHaveLength(expectedPieces);

  const outerW = params.width * SIZE - CLEARANCE;
  const outerD = params.depth * SIZE - CLEARANCE;

  // Tolerance accounts for EDGE_MARGIN (1mm per outer edge = up to +2mm),
  // lip overhang (~0.04mm), and tessellation tolerance.
  const dimTolerance = 3;

  for (const piece of result.pieces) {
    expect(
      hasNoNaNOrInfinity(piece.vertices),
      `${label}: piece ${piece.label} has NaN/Infinity`
    ).toBe(true);
    expect(
      piece.vertices.length,
      `${label}: piece ${piece.label} has degenerate geometry (${piece.vertices.length} verts)`
    ).toBeGreaterThan(100);
    expect(piece.indices.length, `${label}: piece ${piece.label} has no faces`).toBeGreaterThan(0);

    const bb = boundingBox(piece.vertices);
    const pieceW = bb.maxX - bb.minX;
    const pieceD = bb.maxY - bb.minY;

    // Upper bound: no single piece should exceed the full bin dimension.
    // For multi-piece splits this is still a meaningful guard against
    // cut-plane failures that return near-full-width pieces.
    expect(pieceW, `${label}: piece ${piece.label} wider than bin`).toBeLessThan(
      outerW + dimTolerance
    );
    expect(pieceD, `${label}: piece ${piece.label} deeper than bin`).toBeLessThan(
      outerD + dimTolerance
    );

    // Lower bound: each piece should be at least ~(1/expectedPieces) of the
    // full dimension minus tolerance for connectors and tessellation.
    const minFractionW = outerW / expectedPieces - dimTolerance;
    const minFractionD = outerD / expectedPieces - dimTolerance;
    if (minFractionW > 1) {
      expect(pieceW, `${label}: piece ${piece.label} too narrow for split`).toBeGreaterThan(
        minFractionW
      );
    }
    if (minFractionD > 1) {
      expect(pieceD, `${label}: piece ${piece.label} too shallow for split`).toBeGreaterThan(
        minFractionD
      );
    }
    expect(pieceW, `${label}: piece ${piece.label} zero width`).toBeGreaterThan(1);
    expect(pieceD, `${label}: piece ${piece.label} zero depth`).toBeGreaterThan(1);
  }
}
