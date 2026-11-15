import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import type { BinParams, WallCutout, WallCutoutShape } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { boundingBox, columnCrossings } from '../__kernel-tests__/meshAssertions';
import { CUT_RIM_CLEARANCE, LIP_HEIGHT } from '../generatorConstants';
import { FUNNEL_TAPER_RATIO } from '@/shared/utils/wallCutoutPosition';

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

const COLLAR_MM = 6;
const SOCKET_MM = 4.75;
const WALL_4U_MM = 23.25;
const CUT_DROP_MM = 0.5 * (WALL_4U_MM - DEFAULT_BIN_PARAMS.wallThickness);
/** Where a 50% cut bottoms out on a 4u bin. A collar does not move it. */
const COLLAR_BIN_CUT_FLOOR_Z = SOCKET_MM + WALL_4U_MM - CUT_DROP_MM;

/**
 * A collar (`extraWallHeightMm`) raises the rim while the cut keeps its floor on
 * the nominal plane, so the cut has to run up through the collar and the lip.
 * Stopping at the nominal rim leaves a band of wall bridging the window, which
 * is watertight, correctly sized and the right height, so only a probe through
 * the window sees it. The wall beside the window must still carry the collar.
 */
function cutThroughCollar(
  shape: WallCutoutShape,
  stackingLip: boolean,
  cornerRadiusTop: number | null = null
): ScenarioCase {
  const bin = { width: 1, depth: 3, height: 4 } as const;
  const side: WallCutout = { ...DEFAULT_BIN_PARAMS.walls.left, cornerRadiusTop };
  const walls: BinParams['walls'] = {
    ...DEFAULT_BIN_PARAMS.walls,
    enabled: true,
    shape,
    left: side,
    right: side,
  };
  const base = { ...DEFAULT_BIN_PARAMS.base, stackingLip };
  const finish = cornerRadiusTop === null ? '' : `, ${cornerRadiusTop}mm round-over`;
  const name = `${shape} cut runs through a ${COLLAR_MM}mm collar, ${stackingLip ? 'lipped' : 'lipless'}${finish}`;
  return defineScenario('wall cutouts', name, {
    assert: 'structural',
    params: { ...bin, base, walls, extraWallHeightMm: COLLAR_MM },
    compareWith: {
      params: { ...bin, base, walls },
      assert: (collared, plain) => {
        const bb = boundingBox(plain.vertices);
        expect(boundingBox(collared.vertices).maxZ - bb.maxZ, 'collar').toBeCloseTo(COLLAR_MM, 1);
        const t = DEFAULT_BIN_PARAMS.wallThickness / 2;
        // Off the exact centre and the wall's end so no probe runs down a seam.
        const centreY = 0.37;
        const besideY = bb.maxY - 10;
        for (const [wall, x] of [
          ['left', bb.minX + t],
          ['right', bb.maxX - t],
        ] as const) {
          // A scoop's floor is an arc, which tessellates a little proud of itself.
          expect(
            Math.abs(topAt(plain, x, centreY) - COLLAR_BIN_CUT_FLOOR_Z),
            `${wall} window floor, no collar`
          ).toBeLessThan(0.1);
          expect(topAt(collared, x, centreY), `${wall} window open through the collar`).toBeCloseTo(
            topAt(plain, x, centreY),
            2
          );
          expect(
            topAt(collared, x, besideY) - topAt(plain, x, besideY),
            `${wall} wall beside the window`
          ).toBeCloseTo(COLLAR_MM, 1);
        }
      },
    },
  });
}

/**
 * A divider ending inside a funnel is trimmed by a copy of the funnel's
 * profile, and a collar lengthens the funnel's side, which lowers its lean. A
 * copy that leaves the collar out leans harder and notches the divider's end
 * below the slope the wall is cut to.
 */
function funnelTrimsDividerThroughCollar(): ScenarioCase {
  const innerW = 3 * 42 - 0.5 - 2 * 1.2;
  const innerD = 2 * 42 - 0.5 - 2 * 1.2;
  const topHalfWidth = 0.25 * innerW;
  const bottomHalfWidth = FUNNEL_TAPER_RATIO * topHalfWidth;
  // The profile's side spans the drop, the collar, the lip and the clearance.
  const rise = CUT_DROP_MM + COLLAR_MM + LIP_HEIGHT + CUT_RIM_CLEARANCE;
  const lean = topHalfWidth - bottomHalfWidth;
  // The divider at a third of the cavity, just off its centreline.
  const x = innerW / 6 + 0.07;
  const slopeZ = COLLAR_BIN_CUT_FLOOR_Z + ((x - bottomHalfWidth) * rise) / lean;
  return defineScenario(
    'wall cutouts',
    `funnel through a ${COLLAR_MM}mm collar trims a divider end to the wall's slope`,
    {
      assert: 'structural',
      params: {
        width: 3,
        depth: 2,
        height: 4,
        extraWallHeightMm: COLLAR_MM,
        compartments: { cols: 3, rows: 1, cells: [0, 1, 2], thickness: 1.2 },
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          shape: 'funnel',
          front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 50, depth: 50 },
          left: DISABLED_WALL_CUTOUT,
          right: DISABLED_WALL_CUTOUT,
        },
      },
      customAssert: (mesh) => {
        const wallTop = topAt(mesh, x, -innerD / 2 - 0.6);
        expect(Math.abs(wallTop - slopeZ), 'front wall on the funnel slope').toBeLessThan(0.05);
        expect(
          Math.abs(topAt(mesh, x, -innerD / 2 + 0.8) - wallTop),
          'divider end against the wall'
        ).toBeLessThan(0.05);
      },
    }
  );
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
  cutThroughCollar('u-shape', true),
  cutThroughCollar('scoop', false),
  cutThroughCollar('funnel', true, 3),
  funnelTrimsDividerThroughCollar(),
];
