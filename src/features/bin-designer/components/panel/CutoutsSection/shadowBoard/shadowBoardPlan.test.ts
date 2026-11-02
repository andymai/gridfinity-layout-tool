import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { DEFAULT_KNIFE_SPEC } from '@/features/bin-designer/types';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { fitTestFootprintBox } from '@/shared/utils/fitTestPlan';
import { planShadowBoard, type Pt, type ShadowBoardPlan } from './shadowBoardPlan';

function plan(params: BinParams, clearance = false): ShadowBoardPlan {
  const result = planShadowBoard(params, { clearance });
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function cut(id: string, overrides: Partial<Cutout> = {}): Cutout {
  return {
    id,
    shape: 'rectangle',
    x: 10,
    y: 10,
    width: 20,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

function bin(cutouts: Cutout[], overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutouts,
    ...overrides,
  };
}

const box = (ring: readonly Pt[]) => ({
  minX: Math.min(...ring.map((p) => p.x)),
  maxX: Math.max(...ring.map((p) => p.x)),
  minY: Math.min(...ring.map((p) => p.y)),
  maxY: Math.max(...ring.map((p) => p.y)),
});

describe('planShadowBoard openings', () => {
  it('places an opening in the bin-centred frame', () => {
    const params = bin([cut('a')]);
    const { innerW, innerD, offsetX, offsetY } = cutoutInterior(params);
    const [[outer]] = plan(params).openings;
    const b = box(outer);
    expect(b.minX).toBeCloseTo(10 - innerW / 2 + offsetX, 6);
    expect(b.maxX).toBeCloseTo(30 - innerW / 2 + offsetX, 6);
    expect(b.minY).toBeCloseTo(10 - innerD / 2 + offsetY, 6);
    expect(b.maxY).toBeCloseTo(20 - innerD / 2 + offsetY, 6);
  });

  it('cuts every copy of a repeat', () => {
    const array = {
      mode: 'grid' as const,
      cols: 3,
      rows: 1,
      pitchX: 25,
      pitchY: 0,
      count: 3,
      radius: 0,
      startAngle: 0,
      rotateToCenter: false,
    };
    expect(plan(bin([cut('a', { x: 2, array })])).openings).toHaveLength(3);
  });

  it('merges overlapping pockets into one opening', () => {
    expect(plan(bin([cut('a'), cut('b', { x: 25, y: 12 })])).openings).toHaveLength(1);
  });

  it('resolves a subtract group, leaving the cutter as an island', () => {
    const { openings } = plan(
      bin([
        cut('base', { x: 10, y: 10, width: 40, depth: 30, groupId: 'g', groupOp: 'subtract' }),
        cut('cutter', { x: 20, y: 20, width: 10, depth: 10, groupId: 'g', zIndex: 1 }),
      ])
    );
    expect(openings).toHaveLength(1);
    expect(openings[0]).toHaveLength(2);
  });

  it('has nothing to save when only text and hidden shapes are left', () => {
    const result = planShadowBoard(bin([cut('t', { shape: 'text' }), cut('h', { hidden: true })]), {
      clearance: false,
    });
    expect(result).toEqual({ ok: false, error: 'empty' });
  });

  it('draws a round at its size, not the allowance the editor checks fits with', () => {
    const [[outer]] = plan(
      bin([cut('r', { shape: 'circle', x: 2, width: 60, depth: 60 })])
    ).openings;
    const b = box(outer);
    expect(b.maxX - b.minX).toBeLessThanOrEqual(60 + 1e-9);
    expect(b.maxX - b.minX).toBeGreaterThan(59.9);
  });

  it('keeps a pocket inside the interior, as the bin is cut', () => {
    const params = bin([cut('a', { x: -5, width: 20 })]);
    const { innerW, offsetX } = cutoutInterior(params);
    const [[outer]] = plan(params).openings;
    expect(box(outer).minX).toBeCloseTo(-innerW / 2 + offsetX, 6);
  });

  it("runs an open side's channel out to the footprint's edge", () => {
    const params = bin([cut('a', { x: 40, openSides: [{ side: 'right' }] })]);
    const [[outer]] = plan(params).openings;
    expect(box(outer).maxX).toBeCloseTo(fitTestFootprintBox(params).maxX, 6);
  });

  it('cuts no channel for a group whose boolean leaves nothing', () => {
    const params = bin([
      cut('kept', { x: 5, y: 5 }),
      cut('a', {
        shape: 'circle',
        x: 30,
        y: 30,
        width: 10,
        depth: 10,
        groupId: 'g',
        groupOp: 'intersect',
        openSides: [{ side: 'right' }],
      }),
      cut('b', { shape: 'circle', x: 38, y: 38, width: 10, depth: 10, groupId: 'g' }),
    ]);
    const { openings } = plan(params);
    expect(openings).toHaveLength(1);
    expect(box(openings[0][0]).maxX).toBeLessThan(0);
  });

  it("runs a knife slot's open end out through the wall", () => {
    const params = bin([
      cut('k', {
        shape: 'knifeSlot',
        x: 30,
        width: 30,
        depth: 4,
        knife: { ...DEFAULT_KNIFE_SPEC, openEnd: 'end' },
      }),
    ]);
    const [[outer]] = plan(params).openings;
    expect(box(outer).maxX).toBeCloseTo(fitTestFootprintBox(params).maxX, 6);
  });

  it('cuts nothing where a custom footprint has no material', () => {
    const params = bin([cut('a', { x: 50, y: 50, width: 20, depth: 20 })], {
      cellMask: { cols: 4, rows: 4, cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0] },
    });
    expect(planShadowBoard(params, { clearance: false })).toEqual({ ok: false, error: 'empty' });
  });

  describe('mesh imprints', () => {
    const square = (x: number, y: number, h: number) => [
      { x: x - h, y: y - h },
      { x: x + h, y: y - h },
      { x: x + h, y: y + h },
      { x: x - h, y: y + h },
    ];
    const asset = {
      name: 'two',
      data: '',
      triangleCount: 24,
      sizeMm: { x: 40, y: 10, z: 5 },
      outlines: [square(5, 5, 5), square(35, 5, 5)],
    };
    const mesh = (overrides: Partial<Cutout> = {}) =>
      cut('m', { shape: 'mesh', x: 20, y: 20, width: 40, depth: 10, meshId: 'two', ...overrides });

    it('cuts every separate outline of an imprint', () => {
      expect(plan(bin([mesh()], { meshAssets: { two: asset } })).openings).toHaveLength(2);
    });

    it('will not stand in a box for an outline that has not arrived', () => {
      expect(planShadowBoard(bin([mesh()]), { clearance: false })).toEqual({
        ok: false,
        error: 'meshMissing',
      });
    });

    it("cuts an imprint on its own, never inside its group's boolean", () => {
      const { openings } = plan(
        bin(
          [
            cut('base', { x: 10, y: 10, width: 70, depth: 40, groupId: 'g', groupOp: 'subtract' }),
            mesh({ groupId: 'g', zIndex: 1 }),
          ],
          { meshAssets: { two: asset } }
        )
      );
      expect(openings).toHaveLength(1);
      expect(openings[0]).toHaveLength(1);
    });

    it('reaches past the interior with its clearance, as the bin cuts it', () => {
      const params = bin([mesh({ x: 0, clearance: 1 })], { meshAssets: { two: asset } });
      const { innerW, offsetX } = cutoutInterior(params);
      const left = Math.min(...plan(params, true).openings.map(([outer]) => box(outer).minX));
      expect(left).toBeCloseTo(-innerW / 2 + offsetX - 1, 1);
    });

    it('grows round by its clearance', () => {
      const [nominal, grown] = [false, true].map((clearance) =>
        plan(bin([mesh({ clearance: 1 })], { meshAssets: { two: asset } }), clearance)
          .openings.map(([outer]) => box(outer))
          .sort((a, b) => a.minX - b.minX)
      );
      expect(grown[0].maxX - grown[0].minX).toBeCloseTo(nominal[0].maxX - nominal[0].minX + 2, 6);
    });
  });

  it('grows each shape by its clearance the way the bin is cut', () => {
    const corner = (x: number, y: number) => ({
      x,
      y,
      handleIn: null,
      handleOut: null,
      symmetric: false,
    });
    const round = cut('r', { shape: 'circle', x: 2, width: 20, depth: 20, clearance: 1 });
    const rect = cut('q', { x: 30, clearance: 1 });
    const path = cut('p', {
      shape: 'path',
      x: 60,
      y: 10,
      width: 10,
      depth: 10,
      clearance: 1,
      path: [corner(60, 10), corner(70, 10), corner(70, 20), corner(60, 20)],
    });
    const boxes = (clearance: boolean) =>
      plan(bin([round, rect, path]), clearance)
        .openings.map(([outer]) => box(outer))
        .sort((a, b) => a.minX - b.minX);
    const width = (b: ReturnType<typeof box>) => b.maxX - b.minX;
    const [roundN, rectN, pathN] = boxes(false);
    const [roundG, rectG, pathG] = boxes(true);
    // A round grows by its clearance across, a path by it on every side.
    expect(width(roundG) - width(roundN)).toBeCloseTo(1, 2);
    expect(width(pathG) - width(pathN)).toBeCloseTo(2, 6);
    expect(rectG).toEqual(rectN);
  });
});

describe('planShadowBoard islands', () => {
  const corner = (x: number, y: number) => ({
    x,
    y,
    handleIn: null,
    handleOut: null,
    symmetric: false,
  });
  const square = (x0: number, y0: number, x1: number, y1: number) => [
    corner(x0, y0),
    corner(x1, y0),
    corner(x1, y1),
    corner(x0, y1),
  ];
  const tray = cut('t', {
    shape: 'path',
    x: 10,
    y: 10,
    width: 40,
    depth: 20,
    clearance: 1,
    path: square(10, 10, 50, 30),
    holes: [square(25, 15, 35, 25)],
  });

  it('draws a path island as a hole in its opening', () => {
    const [[outer, island]] = plan(bin([tray])).openings;
    expect(box(outer).maxX - box(outer).minX).toBeCloseTo(40, 6);
    expect(box(island).maxX - box(island).minX).toBeCloseTo(10, 6);
  });

  it('shrinks the island by the clearance as the opening grows by it', () => {
    const [[outer, island]] = plan(bin([tray]), true).openings;
    expect(box(outer).maxX - box(outer).minX).toBeCloseTo(42, 6);
    expect(box(island).maxX - box(island).minX).toBeCloseTo(8, 6);
  });
});

describe('planShadowBoard footprint', () => {
  it('rounds the corners of a rectangular bin inside its footprint box', () => {
    const params = bin([cut('a')]);
    const [ring] = plan(params).outline;
    const b = box(ring);
    const footprint = fitTestFootprintBox(params);
    expect(b.minX).toBeCloseTo(footprint.minX, 6);
    expect(b.maxY).toBeCloseTo(footprint.maxY, 6);
    // No point lies in the square corner the 3.75 mm round cuts off.
    const corner = ring.filter((p) => p.x < footprint.minX + 1 && p.y < footprint.minY + 1);
    expect(corner).toEqual([]);
  });

  it('follows a custom footprint, inset by half the tolerance', () => {
    const params = bin([cut('a')], {
      cellMask: { cols: 4, rows: 4, cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0] },
    });
    const outline = plan(params).outline;
    expect(outline).toHaveLength(1);
    expect(outline[0]).toHaveLength(6);
    const b = box(outline[0]);
    expect(b.maxX - b.minX).toBeCloseTo(2 * params.gridUnitMm - 0.5, 6);
  });
});
