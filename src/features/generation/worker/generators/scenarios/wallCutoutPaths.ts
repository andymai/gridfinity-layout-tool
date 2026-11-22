import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import type { BinParams, WallCutout } from '@/shared/types/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

/**
 * Outer wall cutouts carried through the fixed dividers in their path, with
 * `walls.interior` on. `wallCutoutPaths.geometry.test.ts` probes the heights;
 * these keep the combinations a path meets building and exporting cleanly.
 */

const ON: WallCutout = { ...DISABLED_WALL_CUTOUT, enabled: true, width: 40, depth: 50 };
const GRID_3X3 = { cols: 3, rows: 3, cells: [0, 1, 2, 3, 4, 5, 6, 7, 8], thickness: 1.2 };
/** The reporter's bento: two cells merged in the right and middle columns. */
const BENTO = { ...GRID_3X3, cells: [0, 1, 2, 3, 4, 2, 5, 4, 6] };

type Side = 'front' | 'back' | 'left' | 'right';

function walls(
  sides: readonly Side[],
  over: Partial<BinParams['walls']> = {},
  cut: WallCutout = ON
): BinParams['walls'] {
  const pick = (side: Side): WallCutout => (sides.includes(side) ? cut : DISABLED_WALL_CUTOUT);
  return {
    ...DEFAULT_BIN_PARAMS.walls,
    enabled: true,
    shape: 'u-shape',
    front: pick('front'),
    back: pick('back'),
    left: pick('left'),
    right: pick('right'),
    interior: { ...ON, width: 70 },
    ...over,
  };
}

function path(name: string, params: Partial<BinParams>): ScenarioCase {
  return defineScenario('wall cutout paths', name, {
    params: { width: 3, depth: 3, height: 4, compartments: GRID_3X3, ...params },
  });
}

export const wallCutoutPaths: ScenarioCase[] = [
  path('bento, front and left (#5100)', {
    depth: 5,
    compartments: BENTO,
    walls: walls(['front', 'left']),
  }),
  path('grid, front and back', { walls: walls(['front', 'back']) }),
  path('scoop profile through a bento', {
    compartments: BENTO,
    walls: walls(['front', 'left'], { shape: 'scoop' }),
  }),
  path('funnel profile with rounded shoulders', {
    walls: walls(['right'], { shape: 'funnel', cornerRadiusTop: 3 }),
  }),
  path('every wall', { walls: walls(['front', 'back', 'left', 'right']) }),
  path('patterned dividers', {
    compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
    wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
    walls: walls(['front']),
  }),
  path('label tabs on the dividers it crosses', {
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    walls: walls(['front']),
  }),
  path('label tabs on the dividers it lowers', {
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    walls: walls(['left']),
  }),
  path('scoop ramps and an interior fillet', {
    scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
    interiorFilletMm: 2,
    walls: walls(['left']),
  }),
  path('a raised floor beside a lowered divider', {
    compartments: { ...GRID_3X3, floorRaises: [0, 8] },
    walls: walls(['front'], {}, { ...ON, depth: 90 }),
  }),
  path('angled divider across the edge of the path', {
    compartments: {
      ...GRID_3X3,
      dividerOverrides: [{ compartmentA: 4, compartmentB: 5, offsetStart: -12, offsetEnd: 12 }],
    },
    walls: walls(['front'], {}, { ...ON, width: 30 }),
  }),
  path('leaning divider', {
    compartments: {
      ...GRID_3X3,
      dividerOverrides: [
        { compartmentA: 3, compartmentB: 4, offsetStart: 0, offsetEnd: 0, rakeDeg: 20 },
      ],
    },
    walls: walls(['front']),
  }),
  path('under a collar', { extraWallHeightMm: 6, walls: walls(['front', 'left']) }),
  path('thin walls, whose lip support reaches deeper', {
    wallThickness: 0.8,
    walls: walls(['front']),
  }),
  path('notched lip', {
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, lipNotches: true },
    walls: walls(['front']),
  }),
  path('no stacking lip', {
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    walls: walls(['front', 'left']),
  }),
  path('asymmetric overhang', {
    overhang: { ...DEFAULT_BIN_PARAMS.overhang, left: 4, right: 0, front: 2, back: 0 },
    walls: walls(['front', 'left']),
  }),
  path('tapered overhang', {
    overhang: {
      left: 3,
      right: 3,
      front: 3,
      back: 3,
      feet: false,
      taper: {
        enabled: true,
        profile: 'chamfer',
        bandHeight: 6,
        left: 3,
        right: 3,
        front: 3,
        back: 3,
      },
    },
    walls: walls(['front', 'left'], {}, { ...ON, depth: 90 }),
  }),
  path('half-grid width', { width: 2.5, walls: walls(['front', 'left']) }),
  path('a bin shorter than its lip support', {
    height: 2,
    heightUnitMm: 4,
    compartments: { cols: 3, rows: 1, cells: [0, 1, 2], thickness: 1.2 },
    walls: walls(['front'], {}, { ...ON, width: 60, depth: 100 }),
  }),
  path('merged rows of cells too narrow for divider walls', {
    width: 2,
    depth: 2,
    compartments: {
      cols: 11,
      rows: 2,
      cells: [...Array<number>(11).fill(0), ...Array<number>(11).fill(1)],
      thickness: 2.6,
    },
    walls: walls(['front']),
  }),
];
