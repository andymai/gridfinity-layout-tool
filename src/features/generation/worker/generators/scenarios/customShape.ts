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
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_HANDLE_SIDE,
  DISABLED_WALL_CUTOUT,
} from '@/shared/constants/bin';
import type { CellMask } from '@/shared/utils/cellMask';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

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

/**
 * 2×2 bin with one interior half-cell cleared from the bottom-right 1u
 * block. Exercises per-cell half-socket dispatch: three 1u cells emit a
 * full socket each; the mixed 1u emits three quarter sockets.
 *   [ 1 1 1 1 ]
 *   [ 1 1 1 1 ]
 *   [ 1 1 1 1 ]
 *   [ 1 1 1 0 ]
 */
const MIXED_HALF_BIN_MASK: CellMask = buildMask([
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 1, 0],
]);

/**
 * 3×3 O-shape (ring): outer frame filled, centre 1u empty. Exercises the
 * polygon generator's inner-hole path — outer CCW loop plus one CW hole
 * loop, cut together into a single Drawing and extruded.
 */
const O_SHAPE_MASK: CellMask = buildMask([
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 0, 0, 1, 1],
  [1, 1, 0, 0, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
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
  defineScenario('custom-shape', '1.5×1.5 half-bin L user halfSockets off', {
    // Same mask, but user left halfSockets off. The 3×3 mask has no mixed
    // 1u block (only fringe half-cells), so the socket builder uses natural
    // [1, 0.5] × [1, 0.5] decomposition — no quarter sockets.
    params: {
      width: 1.5,
      depth: 1.5,
      cellMask: HALF_L_MASK,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, halfSockets: false },
    },
  }),
  defineScenario('custom-shape', '2×2 mixed-detail per-cell half sockets', {
    // 1u block at the bottom-right is mixed (3 filled, 1 empty) — triggers
    // per-cell dispatch: three full sockets + three quarter sockets.
    params: {
      width: 2,
      depth: 2,
      cellMask: MIXED_HALF_BIN_MASK,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, halfSockets: false },
    },
  }),
  defineScenario('custom-shape', '3×3 O-shape (ring) with lip', {
    // Outer frame + hole in the middle. Exercises the polygon path's
    // inner-loop handling — generator produces an extruded ring.
    params: {
      width: 3,
      depth: 3,
      cellMask: O_SHAPE_MASK,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
  }),
  defineScenario('custom-shape', '3×3 L with front cutout (polygon-aware side mapping)', {
    // Exercises polygon-aware wallCutoutBuilder for the front edge, which
    // spans only 2u of a 3u bin (notch bottom-right truncates the front wall).
    params: {
      width: 3,
      depth: 3,
      cellMask: L_SHAPE_MASK,
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    },
  }),
  defineScenario('custom-shape', '3×3 U with front cutout (single candidate edge)', {
    // U-shape front edge spans the full bottom; polygon resolver picks it
    // cleanly regardless of the multiple back/side candidates.
    params: {
      width: 3,
      depth: 3,
      cellMask: U_SHAPE_MASK,
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    },
  }),
  defineScenario('custom-shape', '3×3 L with front handle (polygon-aware side mapping)', {
    // Exercises polygon-aware handleBuilder: the front edge spans only 2u of
    // the 3u bin, so the handle must be centered on the L's short front arm.
    params: {
      width: 3,
      depth: 3,
      cellMask: L_SHAPE_MASK,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: { ...DEFAULT_HANDLE_SIDE, enabled: true },
      },
    },
  }),
  defineScenario('custom-shape', '3×3 U with front + left handles (multi-side polygon)', {
    // U-shape exposes distinct front/left/right outer edges; validates that
    // each side resolves to its outermost matching polygon segment.
    params: {
      width: 3,
      depth: 3,
      cellMask: U_SHAPE_MASK,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: { ...DEFAULT_HANDLE_SIDE, enabled: true },
        left: { ...DEFAULT_HANDLE_SIDE, enabled: true },
      },
    },
  }),
  defineScenario('custom-shape', '3×3 L with honeycomb pattern (polygon edge enumeration)', {
    // L-shape produces six outer edges (back/left full, front/right each split
    // into a long and short segment by the notch). Every edge gets pattern;
    // only the outermost per cardinal participates in cutout/handle clipping.
    params: {
      width: 3,
      depth: 3,
      cellMask: L_SHAPE_MASK,
      wallPattern: { enabled: true, pattern: 'honeycomb' as const },
    },
  }),
  defineScenario('custom-shape', '3×3 L with honeycomb + front cutout (outermost-edge clip)', {
    // Validates that the cutout border clip lands on the L's short front arm
    // (the outermost front edge) and not on the inner step wall.
    params: {
      width: 3,
      depth: 3,
      cellMask: L_SHAPE_MASK,
      wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    },
  }),
  defineScenario('custom-shape', '3×3 U with honeycomb pattern (multi-side polygon pattern)', {
    // U-shape produces more edges (two front extensions + inner step walls);
    // validates that all axis-aligned outer edges are tiled independently.
    params: {
      width: 3,
      depth: 3,
      cellMask: U_SHAPE_MASK,
      wallPattern: { enabled: true, pattern: 'honeycomb' as const },
    },
  }),
];
