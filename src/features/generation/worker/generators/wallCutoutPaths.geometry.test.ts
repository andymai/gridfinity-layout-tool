// @vitest-environment node
/**
 * An outer wall cutout carried through the dividers in its path, measured on
 * real generated bins.
 *
 * Every check probes a column of the mesh and compares heights with the outer
 * opening's own floor, read off the front wall of the same bin. A triangle
 * count or a bounding box cannot tell a divider standing in the opening from
 * one cut down to it.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  assertWatertight,
  columnCrossings,
} from './__kernel-tests__/meshAssertions';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { GRIDFINITY } from '@/shared/constants/bin';
import type { BinParams, WallCutout } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

const { GRID_SIZE, TOLERANCE } = GRIDFINITY;

const WIDTH = 3;
const DEPTH = 5;
const WALL = 1.2;
const OUTER_W = WIDTH * GRID_SIZE - TOLERANCE;
const OUTER_D = DEPTH * GRID_SIZE - TOLERANCE;
const INNER_W = OUTER_W - 2 * WALL;
const INNER_D = OUTER_D - 2 * WALL;
const CELL_W = INNER_W / 3;
const CELL_D = INNER_D / 3;
/** Column and row boundaries of the 3x3 grid. */
const X1 = -INNER_W / 2 + CELL_W;
const X2 = INNER_W / 2 - CELL_W;
const Y1 = -INNER_D / 2 + CELL_D;
/** Off-axis nudge: a bin's axes are full of shared triangle edges. */
const N = 0.137;

/**
 * The reporter's bento: the right column's back two cells merged, the middle
 * column's front two. Row 0 is the front.
 */
const BENTO = { cols: 3, rows: 3, cells: [0, 1, 2, 3, 4, 2, 5, 4, 6] };

function cut(enabled: boolean, over: Partial<WallCutout> = {}): WallCutout {
  return {
    enabled,
    width: 40,
    depth: 50,
    alignment: 'center',
    offset: 0,
    widthMm: null,
    ...over,
  };
}

function gen(
  sides: Partial<Record<'front' | 'back' | 'left' | 'right', WallCutout>>,
  interior: boolean,
  over: Partial<BinParams> = {},
  forExport = true
): MeshData {
  const defaults = buildParams({});
  return getGenerateBin()(
    buildParams({
      width: WIDTH,
      depth: DEPTH,
      height: 6,
      wallThickness: WALL,
      compartments: { ...defaults.compartments, ...BENTO },
      walls: {
        ...defaults.walls,
        enabled: true,
        shape: 'u-shape',
        front: cut(false),
        back: cut(false),
        left: cut(false),
        right: cut(false),
        ...sides,
        interior: cut(interior),
      },
      ...over,
    }),
    undefined,
    forExport
  );
}

/** Highest surface over a column. */
const topAt = (mesh: MeshData, x: number, y: number): number => {
  const hits = columnCrossings(mesh, x, y);
  return hits[hits.length - 1] ?? -Infinity;
};

/** Mid-thickness of the front wall. */
const FRONT_WALL_Y = -OUTER_D / 2 + WALL / 2;
const BACK_WALL_Y = OUTER_D / 2 - WALL / 2;

describe('wall cutout carried through the dividers', () => {
  let front: MeshData;
  let openingFloor: number;
  let dividerTop: number;

  beforeAll(async () => {
    await initBrepjs();
    front = gen({ front: cut(true) }, true);
    openingFloor = topAt(front, N, FRONT_WALL_Y);
    // The left column's front cell is untouched by a centred 40% opening.
    dividerTop = topAt(front, -45 + N, Y1 + N);
  }, 180_000);

  it('builds a valid, watertight bin', () => {
    assertStructurallyValid(front, 'front path');
    assertWatertight(front, 'front path');
    expect(dividerTop - openingFloor).toBeGreaterThan(10);
  });

  it('lowers a divider running along the path to the opening floor, along its whole run', () => {
    for (const y of [-INNER_D / 2 + 6, -20, 50, INNER_D / 2 - 8]) {
      expect(topAt(front, X2 + N, y + N)).toBeCloseTo(openingFloor, 1);
      expect(topAt(front, X1 - N, y + N)).toBeCloseTo(openingFloor, 1);
    }
  });

  it('cuts a divider crossing the path to the same profile, and only inside it', () => {
    expect(topAt(front, N, Y1 + N)).toBeCloseTo(openingFloor, 1);
    expect(topAt(front, -10 + N, Y1 + N)).toBeCloseTo(openingFloor, 1);
    // Outside the opening's span the crossing divider keeps its full height.
    expect(topAt(front, -35 + N, Y1 + N)).toBeCloseTo(dividerTop, 1);
  });

  it('leaves the far wall and its lip whole behind the path', () => {
    const rim = topAt(front, -45 + N, BACK_WALL_Y);
    expect(topAt(front, N, BACK_WALL_Y)).toBeCloseTo(rim, 2);
    // Just inside the far wall, where the lowered divider meets it, the lip
    // support over the junction is the lip support beside it.
    const inside = INNER_D / 2 - 0.3;
    const atJunction = columnCrossings(front, X2 + N, inside);
    const beside = columnCrossings(front, X2 + 5 + N, inside);
    expect(atJunction.slice(-2)[0]).toBeCloseTo(beside.slice(-2)[0], 1);
    expect(atJunction.slice(-1)[0]).toBeCloseTo(beside.slice(-1)[0], 2);
  });

  it('keeps the per-divider window when no outer wall is cut', () => {
    const interiorOnly = gen({}, true);
    // A centred window on the full-length column divider: low in the middle,
    // full height near its ends.
    const mid = topAt(interiorOnly, X2 + N, N);
    const end = topAt(interiorOnly, X2 + N, INNER_D / 2 - 8);
    expect(end - mid).toBeGreaterThan(10);
  }, 120_000);

  it('keeps the per-divider window when the only outer cut spans nothing', () => {
    const zeroSpan = gen({ front: cut(true, { width: 0 }) }, true);
    const mid = topAt(zeroSpan, X2 + N, N);
    const end = topAt(zeroSpan, X2 + N, INNER_D / 2 - 8);
    expect(end - mid).toBeGreaterThan(10);
  }, 120_000);

  it('cuts no divider while the interior toggle is off', () => {
    const off = gen({ front: cut(true) }, false);
    expect(topAt(off, X2 + N, 50 + N)).toBeCloseTo(dividerTop, 1);
  }, 120_000);
});

describe('wall cutout path under a rounded shoulder', () => {
  const outerD = 3 * GRID_SIZE - TOLERANCE;
  let mesh: MeshData;
  let shoulder: number;

  beforeAll(async () => {
    await initBrepjs();
    // A 39 mm opening ends 0.4 mm short of the column divider's near face, and
    // its 5 mm shoulder carries on over the divider about 3 mm below the rim.
    const defaults = buildParams({});
    mesh = gen({ front: cut(true, { widthMm: 39, depthMm: 18, cornerRadiusTop: 5 }) }, true, {
      depth: 3,
      base: { ...defaults.base, stackingLip: false },
      compartments: { ...defaults.compartments, cols: 3, rows: 1, cells: [0, 1, 2] },
    });
    // The front wall's top over the divider's near face: the shoulder's height there.
    shoulder = topAt(mesh, X2 - 0.6 + 0.01, -outerD / 2 + WALL / 2);
  }, 180_000);

  it('lowers a divider the shoulder reaches past the opening, with no lip', () => {
    assertWatertight(mesh, 'rounded shoulder');
    const rim = topAt(mesh, -45 + N, outerD / 2 - WALL / 2);
    expect(rim - shoulder).toBeGreaterThan(2);
    expect(topAt(mesh, X2 + N, 10 + N)).toBeCloseTo(shoulder, 1);
  });

  it('keeps the lowered top flat up to the wall, with no blend ramp below it', () => {
    const innerD = outerD - 2 * WALL;
    for (const fromWall of [1, 3, 8]) {
      const y = -innerD / 2 + fromWall + N;
      expect(topAt(mesh, X2 + N, y)).toBeCloseTo(shoulder, 1);
      expect(topAt(mesh, X1 - N, y)).toBeCloseTo(shoulder, 1);
    }
  });
});

describe('wall cutout path reaching only part of a divider', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 180_000);

  it('lowers a divider whose near face is inside the opening and its centre outside', () => {
    // A 40 mm square-shouldered opening ends at x = 20. The 2.4 mm column
    // divider centred at x = 20.52 has its near face at x = 19.32.
    const defaults = buildParams({});
    const thickness = 2.4;
    const mesh = gen({ front: cut(true, { widthMm: 40 }) }, true, {
      depth: 3,
      compartments: { ...defaults.compartments, cols: 3, rows: 1, cells: [0, 1, 2], thickness },
    });
    assertStructurallyValid(mesh, 'partial reach');
    assertWatertight(mesh, 'partial reach');
    const outerD = 3 * GRID_SIZE - TOLERANCE;
    const frontWall = -outerD / 2 + WALL / 2;
    const rim = topAt(mesh, -45 + N, frontWall);
    // The opening's bottom edge over the divider's near face.
    const atFace = topAt(mesh, X2 - thickness / 2 + 0.01, frontWall);
    expect(rim - atFace).toBeGreaterThan(10);
    const innerD = outerD - 2 * WALL;
    for (const y of [-innerD / 2 + 2, -20, 10, 40]) {
      expect(topAt(mesh, X2 + N, y + N)).toBeCloseTo(atFace, 1);
      expect(topAt(mesh, X1 - N, y + N)).toBeCloseTo(atFace, 1);
    }
  }, 120_000);
});

describe('wall cutout path beside a shifted divider', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 180_000);

  it('holds a shifted divider up only for a raised floor beside it', () => {
    // Divider 0|1 moved 22 mm right stands at x = 1.48, nearer grid line 2.
    // Only compartment 2, past the other divider, is raised.
    const defaults = buildParams({});
    const mesh = gen({ front: cut(true, { depth: 90 }) }, true, {
      depth: 3,
      compartments: {
        ...defaults.compartments,
        cols: 3,
        rows: 1,
        cells: [0, 1, 2],
        floorRaises: [0, 0, 12],
        dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 22, offsetEnd: 22 }],
      },
    });
    assertWatertight(mesh, 'shifted divider');
    const outerD = 3 * GRID_SIZE - TOLERANCE;
    const floor = topAt(mesh, N, -outerD / 2 + WALL / 2);
    const raised = topAt(mesh, 40 + N, N);
    expect(raised - floor).toBeGreaterThan(5);
    expect(topAt(mesh, X1 + 22 + N, 10 + N)).toBeCloseTo(floor, 1);
  }, 120_000);
});

describe('wall cutout path ending on a divider before a raised floor', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 180_000);

  it('leaves the raised slab past the junction whole', () => {
    // The column divider 0|1 ends on the row divider at y = 0, which spans
    // y = +-0.6. Compartment 2, the back row, is raised; its slab starts at
    // y = 0.4, inside that divider.
    const defaults = buildParams({});
    const mesh = gen({ front: cut(true, { depth: 90 }) }, true, {
      depth: 3,
      compartments: {
        ...defaults.compartments,
        cols: 2,
        rows: 2,
        cells: [0, 1, 2, 2],
        thickness: 1.2,
        floorRaises: [0, 0, 12],
      },
    });
    assertStructurallyValid(mesh, 'junction before a raised floor');
    assertWatertight(mesh, 'junction before a raised floor');
    const outerD = 3 * GRID_SIZE - TOLERANCE;
    const floor = topAt(mesh, N, -outerD / 2 + WALL / 2);
    const raised = topAt(mesh, 20 + N, 30 + N);
    expect(raised - floor).toBeGreaterThan(5);
    // The lowered column divider, then the row divider and the slab past it.
    expect(topAt(mesh, N, -20 + N)).toBeCloseTo(floor, 1);
    expect(topAt(mesh, N, 0.3)).toBeGreaterThanOrEqual(raised - 0.05);
    expect(topAt(mesh, N, 0.7)).toBeCloseTo(raised, 1);
  }, 120_000);
});

describe('wall cutout path with a fillet wider than its compartments', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 180_000);

  it('lowers the dividers in the path and only those', () => {
    // Nine 13.7 mm columns under a centred 40% opening, which ends at x = 24.6.
    const defaults = buildParams({});
    const cols = 9;
    const mesh = gen({ front: cut(true) }, true, {
      depth: 3,
      interiorFilletMm: 15,
      compartments: {
        ...defaults.compartments,
        cols,
        rows: 1,
        cells: Array.from({ length: cols }, (_, i) => i),
      },
    });
    assertWatertight(mesh, 'wide fillet');
    const outerD = 3 * GRID_SIZE - TOLERANCE;
    const innerD = outerD - 2 * WALL;
    const dividerX = (k: number): number => -INNER_W / 2 + (k * INNER_W) / cols;
    const floor = topAt(mesh, N, -outerD / 2 + WALL / 2);
    const fullHeight = topAt(mesh, dividerX(8) + N, N);
    expect(fullHeight - floor).toBeGreaterThan(10);
    // In the path, at x = 20.5.
    expect(topAt(mesh, dividerX(6) + N, N)).toBeCloseTo(floor, 1);
    // Beside it and outside the path, at x = 34.2.
    expect(topAt(mesh, dividerX(7) + N, N)).toBeCloseTo(fullHeight, 1);
    // The fillet rounding the corner between the lowered divider and the far
    // wall goes with the divider.
    expect(topAt(mesh, dividerX(6) + 0.6 + 1, innerD / 2 - 2)).toBeCloseTo(floor, 1);
  }, 120_000);
});

describe('wall cutout path on a square 3x3 grid', () => {
  const OUTER_D_SQUARE = 3 * GRID_SIZE - TOLERANCE;
  const SQUARE_D = OUTER_D_SQUARE - 2 * WALL;
  /** The row boundary between the front and middle rows. */
  const ROW1 = -SQUARE_D / 2 + SQUARE_D / 3;
  const GRID = { cols: 3, rows: 3, cells: [0, 1, 2, 3, 4, 5, 6, 7, 8] };
  const square = (over: Partial<BinParams>, front: WallCutout, forExport = true): MeshData => {
    const defaults = buildParams({});
    return gen(
      { front },
      true,
      {
        depth: 3,
        ...over,
        compartments: { ...defaults.compartments, ...GRID, ...over.compartments },
      },
      forExport
    );
  };

  beforeAll(async () => {
    await initBrepjs();
  }, 180_000);

  it('cuts an angled divider where the path crosses it, and only there', () => {
    // Compartments 4|5 share the middle row's right-hand divider. Angled, its
    // top line runs from x = 8.5 at the front to x = 32.5 at the back, across
    // the edge of a 30% opening at x = 18.5.
    const mesh = square(
      {
        compartments: {
          ...buildParams({}).compartments,
          ...GRID,
          dividerOverrides: [{ compartmentA: 4, compartmentB: 5, offsetStart: -12, offsetEnd: 12 }],
        },
      },
      cut(true, { width: 30 })
    );
    assertWatertight(mesh, 'angled divider');
    const floor = topAt(mesh, N, -OUTER_D_SQUARE / 2 + WALL / 2);
    const on = (t: number): [number, number] => [X2 - 12 + 24 * t, ROW1 + (SQUARE_D / 3) * t];
    expect(topAt(mesh, ...on(0.2))).toBeCloseTo(floor, 1);
    expect(topAt(mesh, ...on(0.8)) - floor).toBeGreaterThan(10);
  }, 120_000);

  describe('with only the front-left floor raised', () => {
    const raisedFrontLeft = (): Partial<BinParams> => ({
      compartments: { ...buildParams({}).compartments, ...GRID, floorRaises: [12] },
    });
    const frontLeftFloor = (mesh: MeshData): number => topAt(mesh, -45 + N, -SQUARE_D / 2 + 10);

    it('opens a window to the path floor where neither compartment beside it is raised', () => {
      const mesh = square(raisedFrontLeft(), cut(true, { width: 25, depth: 90 }));
      const floor = topAt(mesh, N, -OUTER_D_SQUARE / 2 + WALL / 2);
      expect(frontLeftFloor(mesh) - floor).toBeGreaterThan(5);
      // The row divider in the middle column, inside a window clear of the raise.
      expect(topAt(mesh, N, ROW1 + N)).toBeCloseTo(floor, 1);
    }, 120_000);

    it('holds a lowered divider up only beside the raised floor', () => {
      const mesh = square(raisedFrontLeft(), cut(true, { depth: 90 }));
      const floor = topAt(mesh, N, -OUTER_D_SQUARE / 2 + WALL / 2);
      const raised = frontLeftFloor(mesh);
      expect(raised - floor).toBeGreaterThan(5);
      // The column divider beside the raised compartment, then past it.
      expect(topAt(mesh, X1 + N, -SQUARE_D / 2 + 10)).toBeCloseTo(raised, 1);
      expect(topAt(mesh, X1 + N, SQUARE_D / 2 - 10)).toBeCloseTo(floor, 1);
    }, 120_000);
  });

  it('takes a label tab on a divider in the path, and keeps the ones beside it', () => {
    const defaults = buildParams({});
    const label = { label: { ...defaults.label, enabled: true } };
    assertWatertight(square(label, cut(true)), 'label tabs');
    // The preview keeps every shell, so a tab left hanging in the path would
    // still be there; an export drops all but the largest.
    const mesh = square(label, cut(true), false);
    const floor = topAt(mesh, N, -OUTER_D_SQUARE / 2 + WALL / 2);
    const underTab = ROW1 - 2;
    expect(topAt(mesh, N, underTab)).toBeLessThan(floor);
    expect(topAt(mesh, -45 + N, underTab) - floor).toBeGreaterThan(5);
  }, 120_000);
});
