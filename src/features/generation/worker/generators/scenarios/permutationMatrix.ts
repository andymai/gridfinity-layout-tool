import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_HANDLE_SIDE,
  DISABLED_WALL_CUTOUT,
} from '@/shared/constants/bin';
import {
  assertBoundingBoxMatchesParams,
  assertNoDegenerateTriangles,
} from '../__kernel-tests__/meshAssertions';
import { defineScenario, makeInsert, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const ENABLED_SIDE = { ...DEFAULT_HANDLE_SIDE, enabled: true } as const;

const CAT = 'permutation matrix';

export const permutationMatrix: ScenarioCase[] = [
  // ─── Lip junction × interior features ─────────────────────────────────────
  // NOTE: params here intentionally mirror the snapshot-mode scenario in
  // combinedFeatures.ts. The matrix variant adds a bounding-box customAssert
  // so this configuration is locked against silent dimension drift even when
  // the snapshot would be updated for an unrelated triangle-count change.
  defineScenario(CAT, '2×2 lip + 2×2 compartments + scoop', {
    assert: 'structural',
    params: {
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
      scoop: { enabled: true, radius: 'auto' },
    },
    timeout: 60_000,
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, 'lip+compart+scoop');
    },
  }),

  defineScenario(CAT, '2×2 lip + thin walls (0.4mm) + tall (12u)', {
    assert: 'structural',
    params: {
      height: 12,
      wallThickness: 0.4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, 'lip+thin+tall');
      assertNoDegenerateTriangles(result, 'lip+thin+tall');
    },
  }),

  defineScenario(CAT, '2×2 lip + half sockets + magnet base', {
    assert: 'structural',
    params: {
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        stackingLip: true,
        halfSockets: true,
        style: 'magnet',
      },
    },
  }),

  defineScenario(CAT, '2×2 slotted + lip + handle holes (multi-cut + lip)', {
    assert: 'structural',
    params: {
      height: 5,
      style: 'slotted',
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
        left: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, 'slotted+lip+handles');
    },
  }),

  // ─── Floor + wall cut collisions ──────────────────────────────────────────
  defineScenario(CAT, '3×3 inserts + wall cutouts (floor + walls)', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 3,
      height: 5,
      inserts: [
        makeInsert({ id: 'a', shape: 'circle', x: 0, y: 0, width: 18, depth: 18, cutDepth: 4 }),
      ],
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 60, depth: 50 },
        back: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 60, depth: 50 },
      },
    },
    timeout: 60_000,
  }),

  defineScenario(CAT, '2×2 cutouts + handles + label tab (3 cuts)', {
    assert: 'structural',
    params: {
      height: 5,
      cutouts: [makeCutout({ id: 'c1', shape: 'circle', cutDepth: 3 })],
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        right: ENABLED_SIDE,
      },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' },
    },
    timeout: 60_000,
  }),

  defineScenario(CAT, '3×2 inserts + scoop + compartments (floor + back wall + interior)', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      inserts: [
        makeInsert({ id: 'l', shape: 'circle', x: -25, y: 0, width: 15, depth: 15, cutDepth: 3 }),
        makeInsert({ id: 'r', shape: 'circle', x: 25, y: 0, width: 15, depth: 15, cutDepth: 3 }),
      ],
      compartments: { cols: 3, rows: 1, cells: [0, 1, 2], thickness: 0.8 },
      scoop: { enabled: true, radius: 'auto' },
    },
    timeout: 60_000,
  }),

  // ─── Half sockets × sub-features ──────────────────────────────────────────
  defineScenario(CAT, '0.5×0.5 magnet base + half sockets (sub-grid pocket stress)', {
    assert: 'structural',
    params: {
      width: 0.5,
      depth: 0.5,
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        style: 'magnet',
        halfSockets: true,
      },
    },
  }),

  defineScenario(CAT, '2×2 half sockets + honeycomb walls', {
    assert: 'structural',
    params: {
      height: 5,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
      wallPattern: { enabled: true, pattern: 'honeycomb' },
    },
    timeout: 60_000,
  }),

  defineScenario(CAT, '2×2 half sockets + handles', {
    assert: 'structural',
    params: {
      height: 5,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
        back: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),

  defineScenario(CAT, '2×2 half sockets + scoop + lip', {
    assert: 'structural',
    params: {
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        halfSockets: true,
        stackingLip: true,
      },
      scoop: { enabled: true, radius: 'auto' },
    },
    timeout: 60_000,
  }),

  // ─── Wall pattern intersections (honeycomb border clipping) ──────────────
  defineScenario(CAT, '3×3 honeycomb + handles + label (3 cut-throughs)', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 3,
      height: 6,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
        left: ENABLED_SIDE,
      },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    },
    timeout: 120_000,
  }),

  defineScenario(CAT, '4×4 honeycomb + wall cutouts + lip (hex prism + border)', {
    assert: 'structural',
    params: {
      width: 4,
      depth: 4,
      height: 5,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 80, depth: 50 },
        back: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 80, depth: 50 },
      },
    },
    timeout: 120_000,
  }),

  defineScenario(CAT, '1.5×1.5 honeycomb + fractional + lip', {
    assert: 'structural',
    params: {
      width: 1.5,
      depth: 1.5,
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      wallPattern: { enabled: true, pattern: 'honeycomb' },
    },
    timeout: 60_000,
  }),

  // ─── Solid mode × cuts ───────────────────────────────────────────────────
  defineScenario(CAT, '2×2 solid + label tab bracket (top cut through solid)', {
    assert: 'structural',
    params: {
      height: 4,
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        solid: true,
        stackingLip: false,
      },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' },
    },
    timeout: 60_000,
  }),

  defineScenario(CAT, '2×2 solid + handles (cuts above solid surface)', {
    assert: 'structural',
    params: {
      height: 5,
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        solid: true,
        stackingLip: false,
      },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
        back: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),

  defineScenario(CAT, '2×2 solid + grouped cutouts at varying depths', {
    assert: 'structural',
    params: {
      height: 5,
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        solid: true,
        stackingLip: false,
      },
      cutouts: [
        makeCutout({ id: 'shallow', x: -10, cutDepth: 2, groupId: 'g1' }),
        makeCutout({ id: 'deep', x: 10, cutDepth: 6, groupId: 'g1' }),
      ],
    },
    timeout: 60_000,
  }),

  // ─── 4×4 stress: many features at scale ───────────────────────────────────
  defineScenario(CAT, '4×4 magnet + compartments + scoop + label (mega)', {
    assert: 'structural',
    params: {
      width: 4,
      depth: 4,
      height: 6,
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        style: 'magnet',
        stackingLip: true,
      },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
      scoop: { enabled: true, radius: 'auto' },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    },
    timeout: 120_000,
  }),

  defineScenario(CAT, '4×4 slotted + handles + label + lip (multi-cut stress)', {
    assert: 'structural',
    params: {
      width: 4,
      depth: 4,
      height: 6,
      style: 'slotted',
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
        right: ENABLED_SIDE,
      },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    },
    timeout: 120_000,
  }),

  defineScenario(CAT, '4×4 honeycomb + handles + scoop + lip + halfSockets', {
    assert: 'structural',
    params: {
      width: 4,
      depth: 4,
      height: 6,
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        stackingLip: true,
        halfSockets: true,
      },
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      scoop: { enabled: true, radius: 'auto' },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
      },
    },
    timeout: 180_000,
  }),

  // ─── Slotted × interior ─────────────────────────────────────────────────
  defineScenario(CAT, '2×2 slotted + compartments + scoop', {
    assert: 'structural',
    params: {
      style: 'slotted',
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
      scoop: { enabled: true, radius: 'auto' },
    },
    timeout: 60_000,
  }),

  defineScenario(CAT, '2×2 slotted + inserts + lip', {
    assert: 'structural',
    params: {
      style: 'slotted',
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      inserts: [makeInsert({ shape: 'circle', width: 20, depth: 20, cutDepth: 4 })],
    },
    timeout: 60_000,
  }),

  defineScenario(CAT, '2×2 slotted + handles + label', {
    assert: 'structural',
    params: {
      height: 5,
      style: 'slotted',
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
        left: ENABLED_SIDE,
      },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    },
    timeout: 60_000,
  }),

  // ─── Fractional dimensions × features ────────────────────────────────────
  defineScenario(CAT, '1.5×1.5 lip + scoop', {
    assert: 'structural',
    params: {
      width: 1.5,
      depth: 1.5,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      scoop: { enabled: true, radius: 'auto' },
    },
    timeout: 60_000,
  }),

  defineScenario(CAT, '2.5×1 handles + lip (asymmetric + lip)', {
    assert: 'structural',
    params: {
      width: 2.5,
      depth: 1,
      height: 5,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
      },
    },
    timeout: 60_000,
  }),

  defineScenario(CAT, '0.5×2 magnet + lip + half sockets (long half-bin stress)', {
    assert: 'structural',
    params: {
      width: 0.5,
      depth: 2,
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        style: 'magnet',
        stackingLip: true,
        halfSockets: true,
      },
    },
    timeout: 60_000,
  }),

  // ─── Label-tab × interior interactions ──────────────────────────────────
  defineScenario(CAT, '2×2 label tab + compartments + scoop (3-way)', {
    assert: 'structural',
    params: {
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 0.8 },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' },
      scoop: { enabled: true, radius: 'auto' },
    },
    timeout: 60_000,
  }),

  defineScenario(CAT, '2×2 label tab solid + thick walls (gusset edge case)', {
    assert: 'structural',
    params: {
      height: 4,
      wallThickness: 2.0,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'solid' },
    },
  }),

  // ─── Magnet + screw × multiple features ─────────────────────────────────
  defineScenario(CAT, '3×3 magnet+screw base + scoop + label + lip', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 3,
      height: 5,
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        style: 'magnet_and_screw',
        stackingLip: true,
      },
      scoop: { enabled: true, radius: 'auto' },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    },
    timeout: 60_000,
  }),

  defineScenario(CAT, '2×2 weighted base + compartments + scoop', {
    assert: 'structural',
    params: {
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'weighted' },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
      scoop: { enabled: true, radius: 'auto' },
    },
    timeout: 60_000,
  }),

  // ─── Scoop interactions ───────────────────────────────────────────────
  defineScenario(CAT, '2×2 scoop + tall (10u) + lip + thick walls', {
    assert: 'structural',
    params: {
      height: 10,
      wallThickness: 1.6,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      scoop: { enabled: true, radius: 'auto' },
    },
    timeout: 60_000,
  }),
];
