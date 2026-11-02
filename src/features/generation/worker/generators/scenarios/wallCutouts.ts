import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import type { BinParams, WallCutout } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { boundingBox, columnCrossings } from '../__kernel-tests__/meshAssertions';

function topAt(mesh: MeshData, x: number, y: number): number {
  return columnCrossings(mesh, x, y).at(-1) ?? -Infinity;
}

/**
 * A cut the boolean dropped leaves its wall solid, and one that came back
 * empty takes the body with it and leaves the base, and every structural
 * check passes either way. So the bin must keep its full height, and each
 * wall is probed against the same bin uncut.
 */
function scoopEverywhere(
  span: number,
  depth: number,
  bin: Pick<BinParams, 'width' | 'depth' | 'height'>
): ScenarioCase {
  const side: WallCutout = { ...DISABLED_WALL_CUTOUT, enabled: true, width: span, depth };
  const walls: BinParams['walls'] = {
    ...DEFAULT_BIN_PARAMS.walls,
    enabled: true,
    shape: 'scoop',
    front: side,
    back: side,
    left: side,
    right: side,
    interior: side,
  };
  const compartments = { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 };
  const name = `scoop ${span}% x ${depth}% on every wall and the divider, ${bin.width}x${bin.depth}x${bin.height}`;
  return defineScenario('wall cutouts', name, {
    assert: 'structural',
    params: { ...bin, compartments, walls },
    compareWith: {
      params: { ...bin, compartments, walls: { ...walls, enabled: false } },
      assert: (cut, plain) => {
        const bb = boundingBox(plain.vertices);
        expect(boundingBox(cut.vertices).maxZ, 'body height').toBeCloseTo(bb.maxZ, 1);
        const t = DEFAULT_BIN_PARAMS.wallThickness / 2;
        const columns: Record<string, readonly [number, number]> = {
          front: [0.37, bb.minY + t],
          back: [0.37, bb.maxY - t],
          left: [bb.minX + t, 0.41],
          right: [bb.maxX - t, 0.41],
          divider: [0.07, 0.41],
        };
        for (const [wall, [x, y]] of Object.entries(columns)) {
          expect(topAt(cut, x, y), `${wall} is cut`).toBeLessThan(topAt(plain, x, y) - 2);
        }
      },
    },
  });
}

export const wallCutouts: ScenarioCase[] = [
  defineScenario('wall cutouts', 'standard bin with global wall cutouts', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        width: 70,
        depth: 50,
      },
    },
  }),
  defineScenario('wall cutouts', 'slotted bin with per-side wall cutouts', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      style: 'slotted',
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 80, depth: 60 },
        back: DISABLED_WALL_CUTOUT,
        left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 50, depth: 40 },
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    },
  }),
  defineScenario('wall cutouts', 'standard bin with interior wall cutouts and compartments', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 70,
        depth: 50,
        front: DISABLED_WALL_CUTOUT,
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      },
    },
  }),
  defineScenario('wall cutouts', 'interior divider cutout honours alignment + offset (#2323)', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 5,
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        // Reporter's linked config: left + right outer walls and the divider all
        // share a left-aligned, +5mm-offset window.
        front: DISABLED_WALL_CUTOUT,
        back: DISABLED_WALL_CUTOUT,
        left: { enabled: true, width: 40, depth: 50, alignment: 'left', offset: 5, widthMm: null },
        right: { enabled: true, width: 40, depth: 50, alignment: 'left', offset: 5, widthMm: null },
        interior: {
          enabled: true,
          width: 40,
          depth: 50,
          alignment: 'left',
          offset: 5,
          widthMm: null,
        },
      },
    },
  }),
  defineScenario('wall cutouts', 'tilted interior divider cutout with alignment (#2323)', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 5,
      compartments: {
        cols: 2,
        rows: 1,
        cells: [0, 1],
        thickness: 1.2,
        dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: -15, offsetEnd: 15 }],
      },
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: DISABLED_WALL_CUTOUT,
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        // Right-aligned window on a tilted divider exercises the true-length
        // span + the along-wall offset projection.
        interior: {
          enabled: true,
          width: 50,
          depth: 50,
          alignment: 'right',
          offset: 0,
          widthMm: null,
        },
      },
    },
  }),
  defineScenario('wall cutouts', 'full-height u-shape meets the rim square (#3173)', {
    // The reporter's config: a 14mm grid with 2.6mm walls and a 100%-height
    // cutout, so the cut's top edge lands exactly on the rim. The u-shape's top
    // corners are square there now, which makes the boolean coplanar with the
    // wall top — assert the result is still a clean solid.
    assert: 'structural',
    params: {
      width: 3,
      depth: 10,
      height: 5,
      gridUnitMm: 14,
      wallThickness: 2.6,
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: DISABLED_WALL_CUTOUT,
        back: DISABLED_WALL_CUTOUT,
        left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 100 },
        right: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 100 },
        interior: DISABLED_WALL_CUTOUT,
      },
    },
  }),
  defineScenario('wall cutouts', 'full-height u-shape through a stacking lip (#3173)', {
    // Same cut against a lipped wall: the true rim is the lip peak at
    // wallHeight + LIP_HEIGHT, which the overshoot clears by only
    // ~2.1mm — the case where a 5mm corner radius left the most arc behind.
    assert: 'structural',
    params: {
      width: 3,
      depth: 4,
      height: 5,
      gridUnitMm: 14,
      wallThickness: 2.6,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: DISABLED_WALL_CUTOUT,
        back: DISABLED_WALL_CUTOUT,
        left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 100 },
        right: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 100 },
        interior: DISABLED_WALL_CUTOUT,
      },
    },
  }),
  defineScenario('wall cutouts', 'left-aligned cutout with offset and absolute mm width', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 5,
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: { enabled: true, width: 70, depth: 50, alignment: 'left', offset: 5, widthMm: 30 },
        back: { enabled: true, width: 70, depth: 50, alignment: 'right', offset: 0, widthMm: null },
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    },
  }),
  defineScenario('wall cutouts', 'full-width cutout squares its bottom corners', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        // 100% width leaves no wall for the bottom fillet to blend into, so the
        // arc used to stand up as a fin in each corner.
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 100, depth: 60 },
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 100, depth: 60 },
      },
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
    },
  }),
  scoopEverywhere(70, 50, { width: 2, depth: 2, height: 3 }),
  scoopEverywhere(70, 100, { width: 2, depth: 2, height: 6 }),
  // The short walls of a 1-deep bin are narrower than the scoop is deep, so
  // their arc is a full semicircle and the long walls' is a shallow segment.
  scoopEverywhere(70, 100, { width: 2, depth: 1, height: 5 }),
];
