import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { binDimensions, cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import type { GeneratedToolSet } from '@/shared/toolSets/generateToolSet';
import { planToolSetPlacement } from './planToolSetPlacement';

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
  return { cutouts: [box('p', 0, 0, width, depth)], width, depth, deepestCutMm };
}

const params: BinParams = { ...DEFAULT_BIN_PARAMS, width: 1, depth: 1, height: 3, cutouts: [] };

describe('planToolSetPlacement', () => {
  it('sizes an empty bin to the set and centres it', () => {
    const plan = planToolSetPlacement(params, set(200, 150), false);
    expect(plan.size).not.toBeNull();
    const board = cutoutInterior({ ...params, ...plan.size });
    expect(board.innerW).toBeGreaterThanOrEqual(206);
    expect(board.innerD).toBeGreaterThanOrEqual(156);
    expect(plan.dx).toBeCloseTo((board.innerW - 200) / 2, 6);
    expect(plan.dy).toBeCloseTo((board.innerD - 150) / 2, 6);
  });

  it('raises the bin when the deepest pocket does not fit the fill', () => {
    const plan = planToolSetPlacement(params, set(60, 60, 30), false);
    expect(plan.height).not.toBeNull();
    const raised = { ...params, height: plan.height ?? params.height };
    const dims = binDimensions(raised);
    expect(dims.wallHeight - raised.cutoutConfig.topOffset).toBeGreaterThanOrEqual(31);
  });

  it('leaves the height alone when the fill is deep enough', () => {
    expect(
      planToolSetPlacement({ ...params, height: 10 }, set(60, 60, 8), false).height
    ).toBeNull();
  });

  it('puts a second set beside the pockets already there', () => {
    const withPocket = { ...params, width: 4, depth: 3, cutouts: [box('a', 3, 3, 50, 40)] };
    const plan = planToolSetPlacement(withPocket, set(60, 40), false);
    expect(plan.dx).toBeGreaterThanOrEqual(53);
    expect(plan.dy).toBeCloseTo(3, 6);
  });

  it('goes below the pockets when the bin cannot grow that wide', () => {
    const wide = { ...params, width: 16, depth: 3, cutouts: [box('a', 3, 3, 600, 40)] };
    const plan = planToolSetPlacement(wide, set(200, 60), false);
    expect(plan.dy).toBeGreaterThanOrEqual(43);
    expect(plan.dx).toBeCloseTo(3, 6);
  });
});
