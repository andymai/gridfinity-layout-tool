// @vitest-environment node
/**
 * Load-bearing equivariance gate for the opposite-corner tower sharing.
 *
 * A SPLIT baseplate with a point-symmetric custom perimeter lets opposite corner
 * tiles (TL↔BR, TR↔BL) print from ONE canonical mesh placed rotated 180°. That
 * is only correct if the WASM generator is 180°-EQUIVARIANT for outline-clipped,
 * re-based slabs: rotating the canonical tile's mesh 180° must reproduce the
 * opposite tile's own (single-generation) mesh.
 *
 * This test proves it against real OCCT: it generates the canonical tile (A, the
 * shared mesh source) and the opposite tile rendered singly (B, rotation forced
 * off), rotates A's mesh 180° about the body center, and asserts the two are
 * congruent — same triangle count, same enclosed volume, same bounding box, and
 * the rounded cut lands on the SAME corner (orientation, not just size).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBaseplate } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  boundingBox,
  meshVolume,
} from './__kernel-tests__/meshAssertions';
import {
  computeBaseplateTiling,
  pieceToBaseplateParams,
} from '@/features/baseplate/utils/splitPlanner';
import { cornerCutVertices } from '@/shared/utils/cornerCutOutline';
import type { MeshData } from '@/features/generation/bridge/types';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import type { BaseplatePiece } from '@/features/baseplate/types/tiling';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

const NO_OP = (): void => {};
const U = 42;
// 189mm bed tiles the 8×8 plate 2×2.
const BED = 4.5 * U;

const parentParams = (): ResolvedBaseplateParams => ({
  width: 8,
  depth: 8,
  gridUnitMm: U,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  lightweight: true,
  connectorNubs: true,
  preferIdenticalPieces: true,
  // Point-symmetric: a 1-unit radius trims each outer corner cell, keeping every
  // interior seam fully inside so all four corner tiles survive as partials.
  outline: {
    vertices: cornerCutVertices(8 * U, 8 * U, {
      tl: { kind: 'radius', r: U },
      tr: { kind: 'radius', r: U },
      bl: { kind: 'radius', r: U },
      br: { kind: 'radius', r: U },
    }),
  },
});

/** 180° rotation about the Z axis through the origin: (x, y, z) → (−x, −y, z). */
function rotateVertices180Z(vertices: Float32Array): Float32Array {
  const out = new Float32Array(vertices.length);
  for (let i = 0; i < vertices.length; i += 3) {
    out[i] = -vertices[i];
    out[i + 1] = -vertices[i + 1];
    out[i + 2] = vertices[i + 2];
  }
  return out;
}

/** Count mesh vertices inside a 2D mesh-frame window (any Z). */
function countVerticesIn(
  vertices: Float32Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number {
  let count = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1];
    if (x > x0 && x < x1 && y > y0 && y < y1) count++;
  }
  return count;
}

describe('baseplate 180° equivariance (opposite-corner tower sharing #3113)', () => {
  it(
    'reproduces the opposite rounded corner by rotating the canonical mesh 180°',
    { timeout: 240_000 },
    () => {
      const parent = parentParams();
      const tiling = computeBaseplateTiling(parent, BED);
      expect(tiling.pieces).toHaveLength(4);

      const byLabel = new Map(tiling.pieces.map((p) => [p.label, p]));
      // A1 = bottom-left (canonical, rotation 0); B2 = top-right (its 180° mate).
      const canonical = byLabel.get('A1');
      const partner = byLabel.get('B2');
      if (canonical === undefined || partner === undefined) {
        expect.fail('expected A1 and B2 corner tiles');
      }
      // The shared mesh is generated from the canonical (rotation-0) tile; its
      // partner is placed rotated 180°. Confirm that pairing before generating.
      expect(canonical.placementRotationDeg).toBe(0);
      expect(partner.placementRotationDeg).toBe(180);

      const gen = getGenerateBaseplate();
      // A: the shared canonical mesh (what the group actually generates).
      const aParams = pieceToBaseplateParams(canonical, parent);
      // B: the partner as if it printed singly — rotation forced off so its params
      // carry its own unrotated outline/edges/padding (the ground-truth geometry).
      const bTruePiece: BaseplatePiece = { ...partner, placementRotationDeg: 0 };
      const bParams = pieceToBaseplateParams(bTruePiece, parent);

      const aMesh = gen(aParams, NO_OP, true);
      const bMesh: MeshData = gen(bParams, NO_OP, true);
      assertStructurallyValid(aMesh, 'canonical A1');
      assertStructurallyValid(bMesh, 'true B2');

      // Congruent solids tessellate to the same triangle count and enclose the
      // same volume regardless of orientation.
      expect(aMesh.triangleCount).toBe(bMesh.triangleCount);
      expect(meshVolume(aMesh)).toBeCloseTo(meshVolume(bMesh), 1);

      const rotatedA = rotateVertices180Z(aMesh.vertices);

      // Same footprint after the placement rotation the preview applies.
      const rbb = boundingBox(rotatedA);
      const bbb = boundingBox(bMesh.vertices);
      expect(rbb.minX).toBeCloseTo(bbb.minX, 1);
      expect(rbb.maxX).toBeCloseTo(bbb.maxX, 1);
      expect(rbb.minY).toBeCloseTo(bbb.minY, 1);
      expect(rbb.maxY).toBeCloseTo(bbb.maxY, 1);
      expect(rbb.minZ).toBeCloseTo(bbb.minZ, 3);
      expect(rbb.maxZ).toBeCloseTo(bbb.maxZ, 3);

      // Orientation proof: B2's rounded cut sits at the +X/+Y corner (mesh 84,84)
      // and its solid interior corner at −X/−Y. The window near (84,84) must be
      // empty and the opposite corner solid — in BOTH the true B2 mesh and the
      // rotated canonical A1 mesh — so the cut landed on the right corner, not a
      // mirrored one.
      const CUT: [number, number, number, number] = [78, 78, 83, 83];
      const SOLID: [number, number, number, number] = [-83, -83, -78, -78];
      expect(countVerticesIn(bMesh.vertices, ...CUT)).toBe(0);
      expect(countVerticesIn(rotatedA, ...CUT)).toBe(0);
      expect(countVerticesIn(bMesh.vertices, ...SOLID)).toBeGreaterThan(0);
      expect(countVerticesIn(rotatedA, ...SOLID)).toBeGreaterThan(0);
    }
  );
});
