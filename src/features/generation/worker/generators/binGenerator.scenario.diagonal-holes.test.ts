// @vitest-environment node
/**
 * Regression for the bug where two empty mask cells touching only diagonally
 * (a saddle vertex on the polygon boundary) merged into one self-touching
 * figure-8 hole loop and made the BREP cut produce non-manifold geometry.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { assertStructurallyValid } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { CellMask } from '@/shared/utils/cellMask';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

// 4×4 mask in half-cells (= 2×2 bin). Two empty half-cells touch only at
// the corner (1, 1) in grid units: a / saddle.
const DIAGONAL_HOLES_SLASH: CellMask = {
  cols: 4,
  rows: 4,
  cells: [
    // row 0 (bottom)
    1, 1, 1, 1,
    // row 1
    1, 1, 0, 1,
    // row 2
    1, 0, 1, 1,
    // row 3 (top)
    1, 1, 1, 1,
  ] as (0 | 1)[],
};

// Mirror of the / saddle — empties run along the \ diagonal instead.
const DIAGONAL_HOLES_BACKSLASH: CellMask = {
  cols: 4,
  rows: 4,
  cells: [
    // row 0 (bottom)
    1, 1, 1, 1,
    // row 1
    1, 0, 1, 1,
    // row 2
    1, 1, 0, 1,
    // row 3 (top)
    1, 1, 1, 1,
  ] as (0 | 1)[],
};

describe('bin generation with diagonally-adjacent mask holes', () => {
  it.each([
    { id: '/-saddle', mask: DIAGONAL_HOLES_SLASH },
    { id: '\\-saddle', mask: DIAGONAL_HOLES_BACKSLASH },
  ])('generates a valid mesh for $id custom shape', ({ id, mask }) => {
    const generateBin = getGenerateBin();
    const params = buildParams({
      width: 2,
      depth: 2,
      cellMask: mask,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false, solid: true },
    });

    const mesh = generateBin(params, undefined, false);
    assertStructurallyValid(mesh, id);
    expect(mesh.triangleCount).toBeGreaterThan(0);
  });
});
