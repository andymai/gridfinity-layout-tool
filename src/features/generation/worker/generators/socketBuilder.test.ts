// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import type { Shape3D } from 'brepjs';
import type * as SocketBuilder from './socketBuilder';
import { initTestKernel } from '@/test/initTestKernel';

interface CellInfoLike {
  widthUnits: number;
  depthUnits: number;
  centerX: number;
  centerY: number;
}

const GRID_PLAN: SocketBuilder.SocketCellPlan = {
  halfSockets: false,
  latticeX: 'grid',
  latticeY: 'grid',
};
const plan = (
  latticeX: SocketBuilder.FootLattice,
  latticeY: SocketBuilder.FootLattice
): SocketBuilder.SocketCellPlan => ({ halfSockets: false, latticeX, latticeY });
const ALL_PLAN: SocketBuilder.SocketCellPlan = {
  halfSockets: true,
  latticeX: 'grid',
  latticeY: 'grid',
};

type BuildCellSocketFn = (cellW_mm: number, cellD_mm: number) => Shape3D;
type BuildBaseSocketFn = (
  gridW: number,
  gridD: number,
  withMagnet: boolean,
  withScrew: boolean,
  magnetRadius: number,
  magnetDepth: number,
  screwRadius: number,
  forExport?: boolean,
  plan?: SocketBuilder.SocketCellPlan
) => Shape3D;

let buildBaseSocket: BuildBaseSocketFn;
let buildSingleCellSocket: BuildCellSocketFn;
let buildSimplifiedCellSocket: BuildCellSocketFn;
let forEachSocketCell: typeof SocketBuilder.forEachSocketCell;
let resolveSocketCellPlan: typeof SocketBuilder.resolveSocketCellPlan;

let meshShape: (shape: unknown) => { vertices: ArrayLike<number>; triangles: ArrayLike<number> };

beforeAll(async () => {
  const { mesh: meshFn } = await import('brepjs');
  await initTestKernel();

  const mod = await import('./socketBuilder');
  buildBaseSocket = mod.buildBaseSocket;
  buildSingleCellSocket = mod.buildSingleCellSocket;
  buildSimplifiedCellSocket = mod.buildSimplifiedCellSocket;
  forEachSocketCell = mod.forEachSocketCell;
  resolveSocketCellPlan = mod.resolveSocketCellPlan;

  meshShape = (shape) => meshFn(shape as never, { tolerance: 1, angularTolerance: 30 });
}, 30000);

describe('forEachSocketCell fractional edge', () => {
  // Collect the emitted cells for a 2.5×1 grid and locate the 0.5u sliver.
  const collect = (edge?: { x: 'start' | 'end'; y: 'start' | 'end' }) => {
    const cells: { widthUnits: number; centerX: number }[] = [];
    forEachSocketCell(2.5, 1, undefined, 42, GRID_PLAN, (c) => cells.push(c), edge);
    return cells;
  };
  const halfCellX = (cells: { widthUnits: number; centerX: number }[]) =>
    cells.find((c) => Math.abs(c.widthUnits - 0.5) < 1e-6)?.centerX;

  it('defaults the half foot to the positive (right) side', () => {
    const x = halfCellX(collect());
    expect(x).toBeDefined();
    expect(x as number).toBeGreaterThan(0);
  });

  it('places the half foot on the negative (left) side when edge.x is "start"', () => {
    const x = halfCellX(collect({ x: 'start', y: 'end' }));
    expect(x).toBeDefined();
    expect(x as number).toBeLessThan(0);
  });

  it('emits the same number of cells regardless of edge', () => {
    expect(collect().length).toBe(collect({ x: 'start', y: 'end' }).length);
  });
});

describe('buildSingleCellSocket', () => {
  it('builds a valid solid for a full-size cell', () => {
    const shape = buildSingleCellSocket(41.5, 41.5);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangles.length).toBeGreaterThan(0);
  }, 30000);

  it('builds a valid solid for a half-size cell', () => {
    const shape = buildSingleCellSocket(20.5, 20.5);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangles.length).toBeGreaterThan(0);
  }, 30000);
});

describe('buildSimplifiedCellSocket', () => {
  it('builds a valid solid for a full-size cell', () => {
    const shape = buildSimplifiedCellSocket(41.5, 41.5);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('produces fewer triangles than full socket', () => {
    const full = meshShape(buildSingleCellSocket(41.5, 41.5));
    const simplified = meshShape(buildSimplifiedCellSocket(41.5, 41.5));
    expect(simplified.triangles.length).toBeLessThanOrEqual(full.triangles.length);
  }, 30000);
});

describe('buildBaseSocket', () => {
  it('builds a 1x1 socket grid', () => {
    const shape = buildBaseSocket(1, 1, false, false, 3.1, 2, 1.25, false, GRID_PLAN);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangles.length).toBeGreaterThan(0);
  }, 30000);

  it('builds a 2x2 socket grid with magnets', () => {
    const shape = buildBaseSocket(2, 2, true, false, 3.1, 2, 1.25, false, GRID_PLAN);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  }, 60000);

  it('builds a 1.5x1 socket grid with mixed cell sizes', () => {
    const shape = buildBaseSocket(1.5, 1, false, false, 3.1, 2, 1.25, false, GRID_PLAN);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('builds a 2x2 socket grid in half-sockets mode', () => {
    const shape = buildBaseSocket(2, 2, false, false, 3.1, 2, 1.25, false, ALL_PLAN);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  }, 60000);

  it('throws on zero-dimension grid', () => {
    expect(() => buildBaseSocket(0, 0, false, false, 3.1, 2, 1.25, false, GRID_PLAN)).toThrow(
      'at least one cell required'
    );
  });

  // A uniform grid is one repeated cell loft. The template cache should
  // loft it once and clone the rest, rather than re-lofting every cell.
  it('lofts one cell-socket template and clones the rest for a uniform grid', async () => {
    const { clearAllCaches, resetAllShapeCacheStats, getAllShapeCacheStats } =
      await import('./shapeCache');
    clearAllCaches(); // cold socketCache so the cell loop actually runs
    resetAllShapeCacheStats();

    // 3×3 uniform export grid → 9 identical full-size cells.
    buildBaseSocket(3, 3, false, false, 3.1, 2, 1.25, true, GRID_PLAN);

    const stats = getAllShapeCacheStats().find((s) => s.name === 'cell-socket-template');
    expect(stats?.misses).toBe(1); // one loft built
    expect(stats?.hits).toBe(8); // remaining 8 cells cloned from it
  }, 60000);
});

describe('forEachSocketCell foot lattice (#3467)', () => {
  const collect = (
    w: number,
    d: number,
    p: SocketBuilder.SocketCellPlan,
    edge?: { x: 'start' | 'end'; y: 'start' | 'end' }
  ) => {
    const cells: CellInfoLike[] = [];
    forEachSocketCell(w, d, undefined, 42, p, (c) => cells.push(c), edge);
    return cells;
  };
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

  /**
   * Plate cell boundaries in bin-local mm for a bin whose edge sits `offset`
   * grid units past one. A foot straddling one of these rests on the ridge
   * between two pockets instead of dropping into either.
   */
  const ridges = (units: number, offset: number): number[] => {
    const out: number[] = [];
    for (let k = 0; k - offset <= units; k++) {
      const x = (k - offset) * 42;
      if (x > 1e-9 && x < units * 42 - 1e-9) out.push(x);
    }
    return out;
  };
  const straddling = (
    cells: CellInfoLike[],
    units: { w: number; d: number },
    offset: { x: number; y: number }
  ) => {
    const rx = ridges(units.w, offset.x);
    const ry = ridges(units.d, offset.y);
    const halfW = (units.w * 42) / 2;
    const halfD = (units.d * 42) / 2;
    return cells.filter((c) => {
      const x0 = c.centerX - (c.widthUnits * 42) / 2 + halfW;
      const x1 = c.centerX + (c.widthUnits * 42) / 2 + halfW;
      const y0 = c.centerY - (c.depthUnits * 42) / 2 + halfD;
      const y1 = c.centerY + (c.depthUnits * 42) / 2 + halfD;
      return (
        rx.some((r) => x0 < r - 1e-9 && r < x1 - 1e-9) ||
        ry.some((r) => y0 < r - 1e-9 && r < y1 - 1e-9)
      );
    });
  };

  it('ignores the half lattice on a fractional axis', () => {
    // Such an axis already carries a half cell, and `fractionalEdge` decides
    // which end it sits on — which covers both placements on its own. Honouring
    // `half` here would build a layout that perches on-grid, and the mismatch
    // check deliberately skips fractional axes so nothing would warn (review).
    const asked = resolveSocketCellPlan(false, 'half', 'half', undefined, 2.5, 3);
    expect(asked.latticeX).toBe('grid');
    expect(asked.latticeY).toBe('half');
  });

  it('half sockets and a custom shape both override the lattice', () => {
    expect(resolveSocketCellPlan(true, 'half', 'half', undefined, 3, 3)).toEqual({
      halfSockets: true,
      latticeX: 'grid',
      latticeY: 'grid',
    });
  });

  it('grid lattice is unchanged: one full foot per cell', () => {
    expect(collect(3, 3, GRID_PLAN)).toHaveLength(9);
  });

  it('half lattice puts a 0.5u foot at each rim with full cells between', () => {
    // 3u -> [0.5, 1, 1, 0.5], so 4x4 = 16 feet.
    const cells = collect(3, 3, plan('half', 'half'));
    expect(cells).toHaveLength(16);
    expect(cells.filter((c) => near(c.widthUnits, 1) && near(c.depthUnits, 1))).toHaveLength(4);
    expect(cells.reduce((s, c) => s + c.widthUnits * c.depthUnits, 0)).toBeCloseTo(9);
  });

  it('half lattice costs far fewer feet than halving every cell', () => {
    expect(collect(3, 3, ALL_PLAN)).toHaveLength(36);
    expect(collect(3, 3, plan('half', 'half')).length).toBeLessThan(collect(3, 3, ALL_PLAN).length);
  });

  // The point of the whole feature: which layout seats depends on where the bin
  // sits, per axis. A foot must not span a plate cell boundary.
  it('grid seats on-grid and straddles at a half offset', () => {
    const cells = collect(3, 3, GRID_PLAN);
    expect(straddling(cells, { w: 3, d: 3 }, { x: 0, y: 0 })).toHaveLength(0);
    expect(straddling(cells, { w: 3, d: 3 }, { x: 0.5, y: 0.5 }).length).toBeGreaterThan(0);
  });

  it('half seats at a half offset and straddles on-grid', () => {
    const cells = collect(3, 3, plan('half', 'half'));
    expect(straddling(cells, { w: 3, d: 3 }, { x: 0.5, y: 0.5 })).toHaveLength(0);
    expect(straddling(cells, { w: 3, d: 3 }, { x: 0, y: 0 }).length).toBeGreaterThan(0);
  });

  it('halfSockets seats at either offset — the placement-agnostic layout', () => {
    const cells = collect(3, 3, ALL_PLAN);
    expect(straddling(cells, { w: 3, d: 3 }, { x: 0, y: 0 })).toHaveLength(0);
    expect(straddling(cells, { w: 3, d: 3 }, { x: 0.5, y: 0.5 })).toHaveLength(0);
  });

  it('mixed axes seat a bin half-offset on X but on-grid on Y', () => {
    // The reason the lattice is per-axis: applying one layout to both axes
    // straddles ridges on whichever axis it got wrong.
    const at = { x: 0.5, y: 0 };
    const units = { w: 3, d: 3 };
    expect(straddling(collect(3, 3, plan('half', 'grid')), units, at)).toHaveLength(0);
    expect(straddling(collect(3, 3, plan('half', 'half')), units, at).length).toBeGreaterThan(0);
    expect(straddling(collect(3, 3, GRID_PLAN), units, at).length).toBeGreaterThan(0);
  });

  it('mixed axes cost fewer feet than halving both', () => {
    expect(collect(3, 3, plan('half', 'grid'))).toHaveLength(12);
  });

  it('keeps both rims half on a fractional axis', () => {
    const columns = [
      ...new Map(collect(2.5, 1, plan('half', 'grid')).map((c) => [c.centerX, c])).values(),
    ].sort((a, b) => a.centerX - b.centerX);
    const widths = columns.map((c) => c.widthUnits);
    // 2.5u -> [0.5, 1, 0.5, 0.5]: the odd leftover rides inside, both rims stay half.
    expect(widths).toEqual([0.5, 1, 0.5, 0.5]);
    expect(widths.reduce((s, w) => s + w, 0)).toBeCloseTo(2.5);
  });

  it('an integer axis is symmetric, so the fractional edge changes nothing', () => {
    const end = collect(3, 3, plan('half', 'half')).map((c) => c.centerX);
    const start = collect(3, 3, plan('half', 'half'), { x: 'start', y: 'start' }).map(
      (c) => c.centerX
    );
    expect(start).toEqual(end);
  });
});
