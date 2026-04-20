/**
 * Scenarios for non-rectangular (cellMask) bin footprints.
 *
 * Each fixture tests a different boundary of the polygon code path:
 *   - L: one concave corner, asymmetric perimeter
 *   - T: two concave corners + a thin middle arm
 *   - U: two concave corners + U-shaped interior (longest perimeter)
 *   - half-bin L: half-cell resolution, validates mask granularity end-to-end
 *
 * All fixtures produce meshes; triangle counts are snapshotted. When
 * verified visually correct, update with:
 *   pnpm run test:run -- -u src/features/generation/worker/generators/binGenerator.scenario.test
 */
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { CellMask } from '@/shared/utils/cellMask';
import { defineScenario } from '../__dual-kernel__/scenarioTypes';
import type { ScenarioCase } from '../__dual-kernel__/scenarioTypes';

/**
 * Build a cellMask at half-bin resolution from a 2D array where row 0 is
 * the top (reader-friendly). Returned mask uses bottom-first row ordering.
 */
function buildMask(rows: (0 | 1)[][]): CellMask {
  const bottomFirst = rows.slice().reverse();
  const cols = bottomFirst[0]?.length ?? 0;
  return { cols, rows: bottomFirst.length, cells: bottomFirst.flat() };
}

/**
 * 3×3 L-shape with the bottom-right corner (a full 1×1 grid cell) removed.
 * Half-bin resolution: 6×6 mask with bottom-right 2×2 sub-cells empty.
 */
const L_SHAPE_MASK: CellMask = buildMask([
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 0],
  [1, 1, 1, 1, 0, 0],
]);

/**
 * 3×3 T-shape: top row full, bottom two rows have only the center 1×1 cell.
 *   [ 1 1 1 ]
 *   [ 0 1 0 ]
 *   [ 0 1 0 ]
 */
const T_SHAPE_MASK: CellMask = buildMask([
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [0, 0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0],
]);

/**
 * 3×3 U-shape: left/right columns + bottom row filled, open at the top.
 *   [ 1 0 1 ]
 *   [ 1 0 1 ]
 *   [ 1 1 1 ]
 */
const U_SHAPE_MASK: CellMask = buildMask([
  [1, 1, 0, 0, 1, 1],
  [1, 1, 0, 0, 1, 1],
  [1, 1, 0, 0, 1, 1],
  [1, 1, 0, 0, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
]);

/**
 * Half-bin L: 1.5×1.5 bin where the bottom-right half-cell is empty.
 * Mask is 3×3 at half-bin resolution.
 *   [ 1 1 1 ]
 *   [ 1 1 1 ]
 *   [ 1 1 0 ]
 */
const HALF_L_MASK: CellMask = buildMask([
  [1, 1, 1],
  [1, 1, 1],
  [1, 1, 0],
]);

export const customShapes: ScenarioCase[] = [
  defineScenario('custom-shape', '3×3 L with lip', {
    params: {
      width: 3,
      depth: 3,
      cellMask: L_SHAPE_MASK,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
  }),
  defineScenario('custom-shape', '3×3 L flat base no lip', {
    params: {
      width: 3,
      depth: 3,
      cellMask: L_SHAPE_MASK,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
    },
  }),
  defineScenario('custom-shape', '3×3 T with lip', {
    params: {
      width: 3,
      depth: 3,
      cellMask: T_SHAPE_MASK,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
  }),
  defineScenario('custom-shape', '3×3 U with lip', {
    params: {
      width: 3,
      depth: 3,
      cellMask: U_SHAPE_MASK,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
  }),
  defineScenario('custom-shape', '1.5×1.5 half-bin L with lip', {
    params: {
      width: 1.5,
      depth: 1.5,
      cellMask: HALF_L_MASK,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, halfSockets: true },
    },
  }),
];
