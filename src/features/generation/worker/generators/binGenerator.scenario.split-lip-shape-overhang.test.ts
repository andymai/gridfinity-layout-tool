// @vitest-environment node
/**
 * Regression tests for the split-bin stacking lip footprint.
 *
 * When a bin has a stacking lip and is split into pieces, the lip is built
 * separately and fused onto each piece (splitBinBuilder). That separate lip
 * build must use the same footprint as the body — the custom cell mask (L/U
 * shapes) and the overhang. Previously it was built as a bare nominal-size
 * rectangle, so:
 *   - Custom shapes: the rectangular lip juts out over the cleared notch.
 *   - Overhung bins: the lip falls short of the overhung body edge.
 * Both surface as a "missing / broken stacking lip" on the split pieces.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import type { CellMask } from '@/shared/utils/cellMask';
import { initBrepjs, getGenerateSplitPreview } from './__kernel-tests__/wasmInit';
import { boundingBox } from './__kernel-tests__/meshAssertions';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

/** Tessellation + boolean edge tolerance band. */
const XY_MARGIN = 1.5;

const DISABLED_CONNECTORS: SplitConnectorConfig = {
  ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
  enabled: false,
};

// 3×3 L: front-right 1u cell cleared (cols 4–5, rows 0–1 of the 6×6 mask).
const L_SHAPE_MASK: CellMask = {
  cols: 6,
  rows: 6,
  cells: [
    1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1,
  ] as (0 | 1)[],
};

function computeWallTopZ(params: BinParams): number {
  return params.height * params.heightUnitMm;
}

/** Count vertices that fall within the given world-XY rectangle (inclusive bounds). */
function countVerticesInRect(
  vertices: Float32Array,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number
): number {
  let count = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1];
    if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) count++;
  }
  return count;
}

/** X-extent (max − min) of all vertices. */
function xExtent(vertices: Float32Array): number {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    min = Math.min(min, vertices[i]);
    max = Math.max(max, vertices[i]);
  }
  return max - min;
}

/** X-extent (max − min) of vertices above a Z threshold (the lip zone). */
function lipZoneXExtent(vertices: Float32Array, zThreshold: number): number {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    if (vertices[i + 2] > zThreshold) {
      min = Math.min(min, vertices[i]);
      max = Math.max(max, vertices[i]);
    }
  }
  return Number.isFinite(min) ? max - min : 0;
}

describe('split lip footprint follows custom shape', () => {
  it('does not jut the lip over the cleared notch of an L-shaped bin', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 3,
      height: 3,
      cellMask: L_SHAPE_MASK,
    };
    // Cut along X near the center → left/right pieces; the right piece holds the
    // cleared front-right notch.
    const result = generateSplitPreview(params, [1], [], DISABLED_CONNECTORS);
    expect(result.pieces).toHaveLength(2);

    // The notch sits at the bin's front-right (+X, −Y); the right piece (largest
    // offsetX) carries it. tessellatePiece re-centers each piece at its own bbox
    // center, but the right piece's (maxX, minY) corner still maps to the same
    // world corner — the L-shape's concave notch corner. The correct L-shaped
    // lip leaves it empty; a wrongly-rectangular lip's rounded outer wall fills
    // it. (The left piece's (maxX, minY) is its cut-face/front corner, which is
    // legitimately solid — so we must target the right piece specifically.)
    const rightPiece = result.pieces.reduce((a, b) => (b.offsetX > a.offsetX ? b : a));
    const bb = boundingBox(rightPiece.vertices);
    const cornerVertices = countVerticesInRect(
      rightPiece.vertices,
      bb.maxX - 12,
      Infinity,
      -Infinity,
      bb.minY + 12
    );
    expect(cornerVertices).toBe(0);
  }, 90000);
});

describe('split lip footprint follows overhang (#1949)', () => {
  it('grows the lip to the overhung body edge', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const OVERHANG_MM = 18;
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 10,
      depth: 2,
      height: 3,
      overhang: { left: 0, right: OVERHANG_MM, front: 0, back: 0 },
    };
    // Cut at x=0 → two pieces along X; the right piece carries the overhang.
    const result = generateSplitPreview(params, [0], [], DISABLED_CONNECTORS);
    expect(result.pieces).toHaveLength(2);

    const wallTopZ = computeWallTopZ(params);

    // The lip must span the same X range as the body it sits on. Pieces are
    // re-centered for the exploded view, so compare translation-invariant
    // extents rather than absolute positions. Without the fix the lip lacks the
    // overhang and falls ~OVERHANG_MM short of the body edge on the right piece.
    for (const piece of result.pieces) {
      const bodyExt = xExtent(piece.vertices);
      const lipExt = lipZoneXExtent(piece.vertices, wallTopZ + 0.5);
      expect(
        lipExt,
        `piece ${piece.label}: lip X-extent ${lipExt.toFixed(1)} should reach body ${bodyExt.toFixed(1)}`
      ).toBeGreaterThan(bodyExt - XY_MARGIN);
    }
  }, 90000);
});
