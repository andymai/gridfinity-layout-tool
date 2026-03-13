import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { defineScenario, makeInsert, makeCutout } from '../__dual-kernel__/scenarioTypes';
import type { ScenarioCase } from '../__dual-kernel__/scenarioTypes';

export const edgeCases: ScenarioCase[] = [
  // Small bins
  defineScenario('edge cases', '0.5x0.5x2 minimal bin', {
    assert: 'structural',
    params: { width: 0.5, depth: 0.5, height: 2 },
  }),
  defineScenario('edge cases', '1x1x2 small bin', {
    assert: 'structural',
    params: { width: 1, depth: 1, height: 2 },
  }),
  defineScenario('edge cases', '0.5x1x2 half-width bin', {
    assert: 'structural',
    params: { width: 0.5, depth: 1, height: 2 },
  }),

  // Complex compartments
  defineScenario('edge cases', '2x2 with 2x2 compartments', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    },
  }),
  defineScenario('edge cases', '2x2 with 4x4 compartments', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      compartments: {
        cols: 4,
        rows: 4,
        cells: Array.from({ length: 16 }, (_, i) => i),
        thickness: 0.8,
      },
    },
  }),
  defineScenario('edge cases', '1x1 with 2x2 compartments', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    },
  }),

  // Inserts
  defineScenario('edge cases', '2x2 with circle insert', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      inserts: [
        makeInsert({
          shape: 'circle',
          width: 20,
          depth: 20,
          cutDepth: 5,
          x: 0,
          y: 0,
          cornerRadius: 0,
        }),
      ],
    },
  }),
  defineScenario('edge cases', '2x2 with rectangle insert', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      inserts: [
        makeInsert({
          shape: 'rounded-rect',
          width: 30,
          depth: 20,
          cutDepth: 5,
          x: 0,
          y: 0,
          cornerRadius: 3,
        }),
      ],
    },
  }),

  // Extreme heights
  defineScenario('edge cases', '2x2x20 tall bin', {
    assert: 'structural',
    params: { width: 2, depth: 2, height: 20 },
  }),

  // Stress: many compartments
  defineScenario('edge cases', '4x4 with 8x8 compartments', {
    assert: 'structural',
    params: {
      width: 4,
      depth: 4,
      compartments: {
        cols: 8,
        rows: 8,
        cells: Array.from({ length: 64 }, (_, i) => i),
        thickness: 0.8,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('edge cases', '2x2 with 8x8 compartments (tiny cells)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      compartments: {
        cols: 8,
        rows: 8,
        cells: Array.from({ length: 64 }, (_, i) => i),
        thickness: 0.4,
      },
    },
    timeout: 60_000,
  }),

  // Stress: multiple inserts
  defineScenario('edge cases', '4x4 with 4 inserts', {
    assert: 'structural',
    params: {
      width: 4,
      depth: 4,
      inserts: [
        makeInsert({
          id: 'i1',
          shape: 'circle',
          width: 20,
          depth: 20,
          cutDepth: 5,
          x: -30,
          y: -30,
        }),
        makeInsert({ id: 'i2', shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: 30, y: -30 }),
        makeInsert({ id: 'i3', shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: -30, y: 30 }),
        makeInsert({ id: 'i4', shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: 30, y: 30 }),
      ],
    },
  }),

  // Flat floor
  defineScenario('edge cases', '2x2x3 flat floor', {
    assert: 'structural',
    params: { base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' } },
  }),
  defineScenario('edge cases', '1x1x2 flat floor', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
    },
  }),
  defineScenario('edge cases', '2x2x3 flat floor with stacking lip', {
    assert: 'structural',
    params: { base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: true } },
  }),
  defineScenario('edge cases', '2x2x3 flat floor without stacking lip', {
    assert: 'structural',
    params: { base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false } },
  }),
  defineScenario('edge cases', '2x2x3 flat floor with compartments', {
    assert: 'structural',
    params: {
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    },
  }),
  defineScenario('edge cases', '0.5x0.5x2 flat floor (half-bin)', {
    assert: 'structural',
    params: {
      width: 0.5,
      depth: 0.5,
      height: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
    },
  }),

  // Stress: all features combined
  defineScenario('edge cases', '4x4 with everything enabled', {
    assert: 'structural',
    params: {
      width: 4,
      depth: 4,
      height: 6,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
      inserts: [makeInsert({ shape: 'circle', width: 15, depth: 15, cutDepth: 3, x: 0, y: 0 })],
    },
    timeout: 60_000,
  }),

  // Cutout edge-finding robustness
  defineScenario('edge cases', '2x2 with minimum cutout and scoop', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      cutouts: [makeCutout({ id: 'min-cutout', width: 2, depth: 2, cutDepth: 2, scoopRadius: 2 })],
    },
  }),
  defineScenario('edge cases', '2x2 with grouped cutouts at 45\u00b0 rotation and scoop', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      cutouts: [
        makeCutout({
          id: 'group-1',
          width: 10,
          depth: 10,
          cutDepth: 3,
          x: -5,
          y: -5,
          rotation: 45,
          groupId: 'g1',
          scoopRadius: 2,
        }),
        makeCutout({
          id: 'group-2',
          width: 10,
          depth: 10,
          cutDepth: 3,
          x: 5,
          y: 5,
          rotation: 45,
          groupId: 'g1',
          scoopRadius: 2,
        }),
      ],
    },
  }),
  defineScenario('edge cases', '2x2 with grouped cutouts at mixed rotations and scoop', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      cutouts: [
        makeCutout({
          id: 'group-1',
          width: 12,
          depth: 8,
          cutDepth: 3,
          x: -6,
          groupId: 'g1',
          scoopRadius: 2,
        }),
        makeCutout({
          id: 'group-2',
          width: 12,
          depth: 8,
          cutDepth: 3,
          x: 6,
          rotation: 90,
          groupId: 'g1',
          scoopRadius: 2,
        }),
      ],
    },
  }),
  defineScenario('edge cases', '2x2 with ungrouped cutout at 135\u00b0 rotation and scoop', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      cutouts: [
        makeCutout({
          id: 'solo',
          width: 15,
          depth: 10,
          cutDepth: 3,
          rotation: 135,
          scoopRadius: 2,
        }),
      ],
    },
  }),
  defineScenario('edge cases', '2x2 with cutout and excessive scoop radius', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      cutouts: [
        makeCutout({ id: 'excessive', width: 20, depth: 20, cutDepth: 3, scoopRadius: 10 }),
      ],
    },
  }),
  defineScenario('edge cases', '2x2 with stacking lip and cutouts with scoop', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      cutouts: [makeCutout({ id: 'with-lip', shape: 'circle', cutDepth: 3, scoopRadius: 2 })],
    },
  }),

  // Half sockets
  defineScenario('edge cases', '2x2 with half sockets', {
    assert: 'structural',
    params: { base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true } },
  }),
  defineScenario('edge cases', '1x1 with half sockets', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    },
  }),
  defineScenario('edge cases', '1.5x1.5 with half sockets', {
    assert: 'structural',
    params: {
      width: 1.5,
      depth: 1.5,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    },
  }),
  defineScenario('edge cases', '2x2 with half sockets and magnet style (holes on original cells)', {
    assert: 'structural',
    params: { base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true, style: 'magnet' } },
  }),
  defineScenario('edge cases', '2x2 with half sockets and stacking lip', {
    assert: 'structural',
    params: { base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true, stackingLip: true } },
  }),

  // WASM degenerate geometry guards
  defineScenario('edge cases', 'solid mode with cutoutTopOffset >= wallHeight (zero fillHeight)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutoutConfig: { topOffset: 100 },
    },
  }),
  defineScenario('edge cases', 'solid mode with solidSurfaceZ <= 0 and cutouts present', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutoutConfig: { topOffset: 100 },
      cutouts: [makeCutout({ id: 'unreachable', width: 20, depth: 20 })],
    },
  }),
  defineScenario('edge cases', 'solid mode with cutout cutDepth > solidSurfaceZ', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutoutConfig: { topOffset: 10 },
      cutouts: [makeCutout({ id: 'deep', width: 20, depth: 20, cutDepth: 50 })],
    },
  }),
  defineScenario('edge cases', 'insert with excessive cornerRadius (clamped gracefully)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      inserts: [
        makeInsert({
          shape: 'rounded-rect',
          width: 5,
          depth: 5,
          cutDepth: 3,
          x: 0,
          y: 0,
          cornerRadius: 100,
        }),
      ],
    },
  }),
  defineScenario('edge cases', 'insert with zero cutDepth (skipped gracefully)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      inserts: [makeInsert({ shape: 'circle', width: 20, depth: 20, cutDepth: 0, x: 0, y: 0 })],
    },
  }),
  defineScenario('edge cases', 'solid mode with zero-width cutout (skipped gracefully)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutouts: [makeCutout({ id: 'zero-w', width: 0, depth: 20 })],
    },
  }),
  defineScenario('edge cases', 'solid mode with zero-depth cutout (skipped gracefully)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutouts: [makeCutout({ id: 'zero-d', width: 20, depth: 0 })],
    },
  }),
  defineScenario('edge cases', '0.5x0.5 with thick walls (near-zero inner dimensions)', {
    assert: 'structural',
    params: {
      width: 0.5,
      depth: 0.5,
      height: 2,
      wallThickness: 2.4,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
    },
  }),
  defineScenario('edge cases', 'label tab with tabDepth >= wallHeight', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      label: {
        enabled: true,
        support: 'bracket',
        depth: 20,
        width: 100,
        alignment: 'left',
      },
    },
  }),
  defineScenario(
    'edge cases',
    'label tab bracket with gussetLeg <= 0 (tabDepth <= wallThickness)',
    {
      assert: 'structural',
      params: {
        width: 2,
        depth: 2,
        height: 4,
        wallThickness: 2.4,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        label: {
          enabled: true,
          support: 'bracket',
          depth: 2,
          width: 100,
          alignment: 'left',
        },
      },
    }
  ),
  defineScenario('edge cases', 'label tab solid with gussetLeg <= 0 (tabDepth <= wallThickness)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      wallThickness: 2.4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      label: {
        enabled: true,
        support: 'solid',
        depth: 2,
        width: 100,
        alignment: 'left',
      },
    },
  }),
  defineScenario('edge cases', 'solid mode with grouped cutouts including zero-width member', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutouts: [
        makeCutout({ id: 'good', groupId: 'g1' }),
        makeCutout({ id: 'bad', width: 0, x: 20, groupId: 'g1' }),
      ],
    },
  }),
];
