/**
 * Parametric sweep over non-rectangular bin shapes × sizes.
 *
 * For each (preset/shape × bin-size) combination we assert:
 *   1. the generated mesh is structurally valid (no NaN, indices aligned);
 *   2. the bounding box matches the expected footprint;
 *   3. the mesh has materially more triangles than the solid-mode equivalent
 *      of the same shape — regression guard against the "shell() silently
 *      falls back to solid" bug that made L/T/U bins print as bricks.
 *
 * Scope kept intentionally small (3 shapes × 3 sizes = 9 scenarios) because
 * each run spins up brepjs and generates two meshes per case.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import {
  assertStructurallyValid,
  assertBoundingBoxMatchesParams,
} from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { MASK_CELLS_PER_UNIT, type CellMask } from '@/shared/utils/cellMask';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

interface Size {
  readonly w: number;
  readonly d: number;
  readonly label: string;
}

interface ShapeDef {
  readonly id: 'L' | 'T' | 'U';
  readonly minW: number;
  readonly minD: number;
  readonly build: (w: number, d: number) => CellMask;
}

interface Case {
  readonly shape: ShapeDef;
  readonly size: Size;
}

const SIZES: readonly Size[] = [
  { w: 2, d: 2, label: '2×2' },
  { w: 3, d: 3, label: '3×3' },
  { w: 4, d: 3, label: '4×3' },
];

function clearRect(
  cells: (0 | 1)[],
  cols: number,
  colStart: number,
  rowStart: number,
  colCount: number,
  rowCount: number
): void {
  for (let r = rowStart; r < rowStart + rowCount; r++) {
    for (let c = colStart; c < colStart + colCount; c++) {
      cells[r * cols + c] = 0;
    }
  }
}

// Mirror the L/T/U preset builders from ShapeSection here rather than
// importing across the feature boundary — this test lives inside the
// `generation` feature and should not reach into `bin-designer`.
const SHAPES: readonly ShapeDef[] = [
  {
    id: 'L',
    minW: 2,
    minD: 2,
    build: (w, d) => {
      const cols = Math.round(w * MASK_CELLS_PER_UNIT);
      const rows = Math.round(d * MASK_CELLS_PER_UNIT);
      const cells = new Array<0 | 1>(cols * rows).fill(1);
      const cutW = Math.floor(cols / 2);
      const cutD = Math.floor(rows / 2);
      clearRect(cells, cols, cols - cutW, 0, cutW, cutD);
      return { cols, rows, cells };
    },
  },
  {
    id: 'T',
    minW: 3,
    minD: 2,
    build: (w, d) => {
      const cols = Math.round(w * MASK_CELLS_PER_UNIT);
      const rows = Math.round(d * MASK_CELLS_PER_UNIT);
      const cells = new Array<0 | 1>(cols * rows).fill(1);
      const stemHalf = Math.max(1, Math.floor(cols / 6));
      const stemStart = Math.floor(cols / 2) - stemHalf;
      const stemCols = stemHalf * 2;
      const shoulderRows = Math.floor(rows / 2);
      clearRect(cells, cols, 0, 0, stemStart, shoulderRows);
      clearRect(cells, cols, stemStart + stemCols, 0, cols - stemStart - stemCols, shoulderRows);
      return { cols, rows, cells };
    },
  },
  {
    id: 'U',
    minW: 3,
    minD: 2,
    build: (w, d) => {
      const cols = Math.round(w * MASK_CELLS_PER_UNIT);
      const rows = Math.round(d * MASK_CELLS_PER_UNIT);
      const cells = new Array<0 | 1>(cols * rows).fill(1);
      const gapHalf = Math.max(1, Math.floor(cols / 6));
      const gapStart = Math.floor(cols / 2) - gapHalf;
      const gapCols = gapHalf * 2;
      const gapRowStart = Math.floor(rows / 2);
      clearRect(cells, cols, gapStart, gapRowStart, gapCols, rows - gapRowStart);
      return { cols, rows, cells };
    },
  },
];

const MATRIX: readonly Case[] = SHAPES.flatMap((shape) =>
  SIZES.filter((s) => s.w >= shape.minW && s.d >= shape.minD).map((size) => ({ shape, size }))
);

describe('non-rectangular bin generation matrix (shape × size)', () => {
  it.each(MATRIX)('$shape.id at $size.label generates a valid shelled mesh', ({ shape, size }) => {
    const generateBin = getGenerateBin();
    const cellMask = shape.build(size.w, size.d);
    const label = `${shape.id} @ ${size.label}`;

    const shelled = generateBin(
      buildParams({
        width: size.w,
        depth: size.d,
        cellMask,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false, solid: false },
      }),
      undefined,
      false
    );
    const solid = generateBin(
      buildParams({
        width: size.w,
        depth: size.d,
        cellMask,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false, solid: true },
      }),
      undefined,
      false
    );

    assertStructurallyValid(shelled, label);
    assertBoundingBoxMatchesParams(
      shelled,
      buildParams({ width: size.w, depth: size.d, cellMask }),
      label
    );

    // Shell regression guard: hollowed bins must have materially more
    // triangles than the solid extrusion (interior walls + floor top).
    expect(
      shelled.triangleCount,
      `${label}: shelled (${shelled.triangleCount}) should be materially larger than solid (${solid.triangleCount})`
    ).toBeGreaterThan(solid.triangleCount * 1.5);
  });
});
