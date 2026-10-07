import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

/**
 * Chamfered pockets inside a shallower pocket, chamfered where they open onto
 * its floor. The export matrix runs these too, which is what proves a sunk
 * chamfer and a trimmed flare both leave a watertight, manifold part where they
 * meet the floor and the enclosing wall.
 */
const CAT = 'nested chamfers';

const HOST: Partial<BinParams> = {
  style: 'solid',
  height: 5,
  base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
};

const CHAMFER = 0.8;

const FREEFORM_TRAY = makeCutout({
  id: 'tray',
  shape: 'path',
  x: 8,
  y: 8,
  width: 60,
  depth: 47.5,
  cutDepth: 6,
  chamferWidth: CHAMFER,
  path: [
    { x: 8, y: 8, handleIn: null, handleOut: null, symmetric: false },
    { x: 68, y: 8, handleIn: null, handleOut: null, symmetric: false },
    { x: 68, y: 48, handleIn: null, handleOut: { dx: -20, dy: 10 }, symmetric: false },
    { x: 8, y: 48, handleIn: { dx: 20, dy: 10 }, handleOut: null, symmetric: false },
  ],
});

const TRAY = makeCutout({ id: 'tray', x: 8, y: 8, width: 60, depth: 40, cutDepth: 6 });

function slot(overrides: Partial<Cutout>): Cutout {
  return makeCutout({
    id: 'slot',
    shape: 'slot',
    x: 20,
    y: 22,
    width: 30,
    depth: 8,
    cutDepth: 14,
    chamferWidth: CHAMFER,
    ...overrides,
  });
}

export const nestedChamfers: ScenarioCase[] = [
  defineScenario(CAT, '2×2 solid, slot inside and circle across a freeform tray', {
    params: {
      ...HOST,
      cutouts: [
        FREEFORM_TRAY,
        slot({}),
        makeCutout({
          id: 'circle',
          shape: 'circle',
          x: 60,
          y: 14,
          width: 16,
          depth: 16,
          cutDepth: 14,
          clearance: 0.2,
          chamferWidth: CHAMFER,
        }),
      ],
    },
  }),
  defineScenario(CAT, '2×2 solid, repeated slots and a union member nested at the floor', {
    params: {
      ...HOST,
      cutouts: [
        TRAY,
        slot({
          y: 12,
          depth: 6,
          cutDepth: 12,
          rotation: 10,
          array: {
            mode: 'grid',
            cols: 1,
            rows: 3,
            pitchX: 1,
            pitchY: 11,
            count: 1,
            radius: 1,
            startAngle: 0,
            rotateToCenter: false,
          },
        }),
        makeCutout({ id: 'shelf', x: 20, y: 52, width: 40, depth: 20, cutDepth: 4, groupId: 'g' }),
        makeCutout({
          id: 'well',
          shape: 'circle',
          x: 50,
          y: 56,
          width: 12,
          depth: 12,
          cutDepth: 12,
          chamferWidth: CHAMFER,
          groupId: 'g',
        }),
      ],
    },
  }),
  defineScenario(CAT, '2×2 solid, leaned slot nested in a tray', {
    params: { ...HOST, cutouts: [TRAY, slot({ leanDeg: 20 })] },
  }),
];
