import { describe, it, expect, vi, afterEach } from 'vitest';
import { err, layoutInvalidOperation, ok } from '@/core/result';
import { binId, categoryId, designId, gridUnits, layerId } from '@/core/types';
import type { Coord } from '@/core/types';
import type { SlantConfig } from '@/core/types';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { registerSlantRowDesigner } from '@/shared/utils/slantRowDesign';
import type { SlantRowDesignSpec } from '@/shared/utils/slantRowDesign';
import { paintSlantedRows, slantedPaintArea, slantedRowHeight } from './paintSlantedRows';
import type { AddBinParams } from './types';

const layout = createTestLayout();
const at = (x: number, y: number): Coord => ({ x: gridUnits(x), y: gridUnits(y) });
const BACK: SlantConfig = { angleDeg: 45, side: 'back' };

function run(overrides: Partial<Parameters<typeof paintSlantedRows>[0]> = {}) {
  const addBin = vi.fn((_bin: AddBinParams) => ok(binId(`b${String(addBin.mock.calls.length)}`)));
  const onPlaced = vi.fn();
  const onFailed = vi.fn();
  const promise = paintSlantedRows({
    layout,
    layerId: layerId('layer1'),
    categoryId: categoryId('cat1'),
    size: { width: 2, depth: 1 },
    slant: BACK,
    start: at(1, 0),
    current: at(2, 4),
    minSize: 1,
    addBin,
    execute: (fn) => fn(),
    onPlaced,
    onFailed,
    designName: (height) => `Pens ${String(height)}`,
    ...overrides,
  });
  return { promise, addBin, onPlaced, onFailed };
}

afterEach(() => registerSlantRowDesigner(null));

describe('paintSlantedRows', () => {
  it('links every bin to one design and gives the leading bin the end support', async () => {
    const designer = vi.fn(async (_spec: SlantRowDesignSpec) => designId('d1'));
    registerSlantRowDesigner(designer);
    const { promise, addBin, onPlaced } = run();
    await promise;

    expect(designer).toHaveBeenCalledTimes(1);
    expect(designer.mock.calls[0][0]).toMatchObject({
      name: 'Pens 12',
      width: 2,
      depth: 1,
      height: slantedRowHeight(layout),
      slant: BACK,
    });
    const placed = addBin.mock.calls.map(([bin]) => bin);
    expect(placed.map((bin) => bin.y)).toEqual([0, 1, 2]);
    expect(placed.every((bin) => bin.linkedDesignId === 'd1')).toBe(true);
    expect(placed.slice(0, 2).every((bin) => bin.slant === undefined)).toBe(true);
    expect(placed[2].slant).toEqual({ ...BACK, endSupport: true });
    expect(onPlaced).toHaveBeenCalledWith(['b1', 'b2', 'b3']);
  });

  it('keeps the leading bin in the row when its support has no room', async () => {
    registerSlantRowDesigner(async () => designId('d1'));
    const addBin = vi.fn((bin: AddBinParams) =>
      bin.slant?.endSupport ? err(layoutInvalidOperation('addBin', 'collision')) : ok(binId('b'))
    );
    const { promise } = run({ addBin });
    await promise;
    expect(addBin.mock.calls.at(-1)?.[0].slant).toBeUndefined();
    expect(addBin.mock.calls.at(-1)?.[0].y).toBe(2);
  });

  it('says so when the area holds no row, or the design cannot be saved', async () => {
    registerSlantRowDesigner(async () => designId('d1'));
    const small = run({ current: at(2, 0), start: at(1, 7) });
    await small.promise;
    expect(small.onFailed).not.toHaveBeenCalled();

    const none = run({ start: at(1, 0), current: at(1, 0), size: { width: 9, depth: 9 } });
    await none.promise;
    expect(none.onFailed).toHaveBeenCalledWith('noRoom');

    const designer = vi.fn(async () => designId('d1'));
    registerSlantRowDesigner(designer);
    const taken = createTestLayout({
      bins: [createTestBin({ width: gridUnits(10), depth: gridUnits(8) })],
    });
    const covered = run({ layout: taken });
    await covered.promise;
    expect(covered.onFailed).toHaveBeenCalledWith('noRoom');
    expect(designer).not.toHaveBeenCalled();

    registerSlantRowDesigner(async () => null);
    const unsaved = run();
    await unsaved.promise;
    expect(unsaved.onFailed).toHaveBeenCalledWith('saveFailed');
    expect(unsaved.addBin).not.toHaveBeenCalled();
  });
});

describe('slantedPaintArea', () => {
  const gesture = { size: { width: 2, depth: 1 }, minSize: 1, layout };

  it('covers the dragged cells', () => {
    expect(
      slantedPaintArea({ ...gesture, slant: BACK, start: at(3, 4), current: at(1, 1) })
    ).toEqual({ x: 1, y: 1, width: 3, depth: 4 });
  });

  it('runs a click from its cell to the drawer edge it leans toward, centred across', () => {
    const click = at(3, 2);
    expect(slantedPaintArea({ ...gesture, slant: BACK, start: click, current: click })).toEqual({
      x: 2,
      y: 2,
      width: 2,
      depth: 6,
    });
    expect(
      slantedPaintArea({
        ...gesture,
        slant: { ...BACK, side: 'front' },
        start: click,
        current: click,
      })
    ).toEqual({ x: 2, y: 0, width: 2, depth: 3 });
  });

  it('keeps a click inside the drawer across the lean, as the upright brush does', () => {
    const edge = at(9, 2);
    expect(slantedPaintArea({ ...gesture, slant: BACK, start: edge, current: edge }).x).toBe(8);
    const top = at(3, 7);
    expect(
      slantedPaintArea({
        ...gesture,
        size: { width: 1, depth: 2 },
        slant: { ...BACK, side: 'right' },
        start: top,
        current: top,
      })
    ).toEqual({ x: 3, y: 6, width: 7, depth: 2 });
  });
});
