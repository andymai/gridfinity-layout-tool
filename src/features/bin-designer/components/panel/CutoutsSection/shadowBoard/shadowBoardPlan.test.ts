import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { fitTestFootprintBox } from '@/shared/utils/fitTestPlan';
import { planShadowBoard, type Pt } from './shadowBoardPlan';

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
    const [[outer]] = planShadowBoard(params, { clearance: false }).openings;
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
    expect(
      planShadowBoard(bin([cut('a', { x: 2, array })]), { clearance: false }).openings
    ).toHaveLength(3);
  });

  it('merges overlapping pockets into one opening', () => {
    const plan = planShadowBoard(bin([cut('a'), cut('b', { x: 25, y: 12 })]), { clearance: false });
    expect(plan.openings).toHaveLength(1);
  });

  it('resolves a subtract group, leaving the cutter as an island', () => {
    const plan = planShadowBoard(
      bin([
        cut('base', { x: 10, y: 10, width: 40, depth: 30, groupId: 'g', groupOp: 'subtract' }),
        cut('cutter', { x: 20, y: 20, width: 10, depth: 10, groupId: 'g', zIndex: 1 }),
      ]),
      { clearance: false }
    );
    expect(plan.openings).toHaveLength(1);
    expect(plan.openings[0]).toHaveLength(2);
  });

  it('leaves out text and hidden shapes', () => {
    const plan = planShadowBoard(bin([cut('t', { shape: 'text' }), cut('h', { hidden: true })]), {
      clearance: false,
    });
    expect(plan.openings).toEqual([]);
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
      planShadowBoard(bin([round, rect, path]), { clearance })
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

describe('planShadowBoard footprint', () => {
  it('rounds the corners of a rectangular bin inside its footprint box', () => {
    const params = bin([cut('a')]);
    const [ring] = planShadowBoard(params, { clearance: false }).outline;
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
    const outline = planShadowBoard(params, { clearance: false }).outline;
    expect(outline).toHaveLength(1);
    expect(outline[0]).toHaveLength(6);
    const b = box(outline[0]);
    expect(b.maxX - b.minX).toBeCloseTo(2 * params.gridUnitMm - 0.5, 6);
  });
});
