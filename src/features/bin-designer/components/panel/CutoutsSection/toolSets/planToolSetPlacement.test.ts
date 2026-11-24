import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams, Cutout, ToolSetSpec } from '@/features/bin-designer/types';
import { binDimensions, cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import type { GeneratedToolSet } from '@/shared/toolSets/generateToolSet';
import { innermostSet, partsOf, planToolSetPlacement } from './planToolSetPlacement';

const box = (id: string, x: number, y: number, w: number, d: number): Cutout => ({
  id,
  shape: 'rectangle',
  x,
  y,
  width: w,
  depth: d,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
});

function set(width: number, depth: number, deepestCutMm = 8): GeneratedToolSet {
  return {
    cutouts: [box('p', 0, 0, width, depth)],
    width,
    depth,
    deepestCutMm,
    channelDropped: false,
  };
}

const params: BinParams = { ...DEFAULT_BIN_PARAMS, width: 1, depth: 1, height: 3, cutouts: [] };

function placed(p: BinParams, s: GeneratedToolSet) {
  const plan = planToolSetPlacement(p, s, false);
  if (!plan) throw new Error('expected a placement');
  return plan;
}

describe('planToolSetPlacement', () => {
  it('sizes an empty bin to the set and centres it', () => {
    const plan = placed(params, set(200, 150));
    expect(plan.size).not.toBeNull();
    const board = cutoutInterior({ ...params, ...plan.size });
    expect(board.innerW).toBeGreaterThanOrEqual(206);
    expect(board.innerD).toBeGreaterThanOrEqual(156);
    expect(plan.dx).toBeCloseTo((board.innerW - 200) / 2, 6);
    expect(plan.dy).toBeCloseTo((board.innerD - 150) / 2, 6);
  });

  it('raises the bin when the deepest pocket does not fit the fill', () => {
    const plan = placed(params, set(60, 60, 30));
    expect(plan.height).not.toBeNull();
    const raised = { ...params, height: plan.height ?? params.height };
    const dims = binDimensions(raised);
    expect(dims.wallHeight - raised.cutoutConfig.topOffset).toBeGreaterThanOrEqual(31);
  });

  it('leaves the height alone when the fill is deep enough', () => {
    expect(placed({ ...params, height: 10 }, set(60, 60, 8)).height).toBeNull();
  });

  it('puts a second set beside the pockets already there', () => {
    const withPocket = { ...params, width: 4, depth: 3, cutouts: [box('a', 3, 3, 50, 40)] };
    const plan = placed(withPocket, set(60, 40));
    expect(plan.dx).toBeGreaterThanOrEqual(53);
    expect(plan.dy).toBeCloseTo(3, 6);
  });

  it('counts every copy of a repeated pocket as taken', () => {
    const repeated: Cutout = {
      ...box('a', 3, 3, 50, 40),
      array: {
        mode: 'grid',
        cols: 2,
        rows: 1,
        pitchX: 60,
        pitchY: 0,
        count: 1,
        radius: 0,
        startAngle: 0,
        rotateToCenter: false,
      },
    };
    const plan = placed({ ...params, width: 6, depth: 3, cutouts: [repeated] }, set(60, 40));
    expect(plan.dx).toBeGreaterThanOrEqual(113);
  });

  it('goes below the pockets when the bin cannot grow that wide', () => {
    const wide = { ...params, width: 16, depth: 3, cutouts: [box('a', 3, 3, 600, 40)] };
    const plan = placed(wide, set(200, 60));
    expect(plan.dy).toBeGreaterThanOrEqual(43);
    expect(plan.dx).toBeCloseTo(3, 6);
  });

  it('refuses a set larger than any bin the designer can make', () => {
    expect(planToolSetPlacement(params, set(1000, 60), false)).toBeNull();
  });

  it('refuses a set that would land on a missing cell of a custom footprint', () => {
    const lShape: BinParams = {
      ...params,
      width: 2,
      depth: 2,
      cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] },
    };
    expect(planToolSetPlacement(lShape, set(70, 70), false)).toBeNull();
  });
});

describe('partsOf', () => {
  const spec: ToolSetSpec = {
    family: 'combinationWrench',
    units: 'metric',
    sizes: ['13'],
    style: 'flat',
    clearanceMm: 0.4,
    labelSizeMm: 5,
    fingerChannel: true,
  };
  const sets = { outer: spec, inner: spec };
  const part = (id: string, chain: string[], toolSetPart?: 'channel'): Cutout => ({
    ...box(id, 0, 0, 10, 10),
    parentGroups: chain,
    ...(toolSetPart ? { toolSetPart } : {}),
  });

  it('takes the generated parts of a set, not shapes the user added', () => {
    const cutouts = [part('a', ['outer'], 'channel'), part('mine', ['outer'])];
    expect(partsOf(cutouts, 'outer', sets).map((c) => c.id)).toEqual(['a']);
  });

  it('leaves a set nested inside it to that set', () => {
    const cutouts = [part('a', ['outer'], 'channel'), part('b', ['outer', 'inner'], 'channel')];
    expect(partsOf(cutouts, 'outer', sets).map((c) => c.id)).toEqual(['a']);
    expect(partsOf(cutouts, 'inner', sets).map((c) => c.id)).toEqual(['b']);
    expect(innermostSet(cutouts[1], sets)).toBe('inner');
    expect(innermostSet(part('c', ['x']), sets)).toBeNull();
  });
});
