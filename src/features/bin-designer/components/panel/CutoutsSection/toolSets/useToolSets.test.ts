import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { ToolSetSpec } from '@/features/bin-designer/types';
import { getRotatedBounds } from '../geometryCore';
import { binBoard } from '../packIntoBin';
import { checkPockets } from '../pocketChecks';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { boxesOverlap, cutBoxes } from './planToolSetPlacement';
import { membersOf, useToolSets } from './useToolSets';

const spec: ToolSetSpec = {
  family: 'combinationWrench',
  units: 'metric',
  sizes: ['8', '10', '13'],
  style: 'flat',
  clearanceMm: 0.4,
  labelSizeMm: 5,
  fingerChannel: true,
};

function onlySetId(): string {
  const ids = Object.keys(useDesignerStore.getState().params.cutoutToolSets ?? {});
  expect(ids).toHaveLength(1);
  return ids[0];
}

describe('useToolSets', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('adds a set as one container with its spec and name, in one undo step', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      expect(result.current.insertSet(spec)).toBe('added');
    });
    const { params } = useDesignerStore.getState();
    const setId = onlySetId();
    const members = membersOf(params.cutouts, setId);
    expect(members.length).toBe(params.cutouts.length);
    expect(members.filter((c) => c.shape === 'path')).toHaveLength(3);
    expect(params.cutoutToolSets?.[setId]).toEqual(spec);
    expect(params.cutoutGroupNames?.[setId]).toBe('Wrenches 8 to 13 mm');

    act(() => useDesignerStore.getState().undo());
    const after = useDesignerStore.getState().params;
    expect(after.cutouts).toHaveLength(0);
    expect(after.cutoutToolSets).toBeUndefined();
  });

  it('passes the editor own pocket checks: no thin wall between wrenches', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet({ ...spec, sizes: ['8', '10', '12', '13', '14', '17', '19'] });
    });
    const { params } = useDesignerStore.getState();
    const issues = checkPockets(params.cutouts, params, binBoard(params));
    expect(issues.filter((i) => i.kind === 'thin' || i.kind === 'wall')).toEqual([]);
  });

  it('grows the bin to hold the set', () => {
    const { result } = renderHook(() => useToolSets());
    const before = useDesignerStore.getState().params;
    act(() => {
      result.current.insertSet(spec);
    });
    const after = useDesignerStore.getState().params;
    expect(after.width).toBeGreaterThan(before.width);
    expect(
      useDesignerStore.getState().params.cutouts.every((c) => getRotatedBounds(c).minX >= 0)
    ).toBe(true);
  });

  it('rebuilds a set in place under the same id, with the new sizes', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet(spec);
    });
    const setId = onlySetId();
    const oldLeft = Math.min(
      ...membersOf(useDesignerStore.getState().params.cutouts, setId).map(
        (c) => getRotatedBounds(c).minX - (c.clearance ?? 0)
      )
    );
    const next = { ...spec, sizes: ['8', '10', '13', '17'] };
    act(() => {
      expect(result.current.rebuildSet(setId, next)).toBe('updated');
    });
    const { params } = useDesignerStore.getState();
    const members = membersOf(params.cutouts, setId);
    expect(members.filter((c) => c.shape === 'path')).toHaveLength(4);
    expect(params.cutoutToolSets?.[setId]).toEqual(next);
    expect(params.cutoutGroupNames?.[setId]).toBe('Wrenches 8 to 17 mm');
    const newLeft = Math.min(...members.map((c) => getRotatedBounds(c).minX - (c.clearance ?? 0)));
    expect(newLeft).toBeCloseTo(oldLeft, 1);
  });

  it('keeps a name the user typed when the set is rebuilt', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet(spec);
    });
    const setId = onlySetId();
    act(() => useDesignerStore.getState().setCutoutGroupName(setId, 'Garage wrenches'));
    act(() => {
      result.current.rebuildSet(setId, { ...spec, sizes: ['10'] });
    });
    expect(useDesignerStore.getState().params.cutoutGroupNames?.[setId]).toBe('Garage wrenches');
  });

  it('drops the spec when the last member of the set goes', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet(spec);
    });
    const ids = useDesignerStore.getState().params.cutouts.map((c) => c.id);
    act(() => useDesignerStore.getState().removeCutoutsBatch(ids));
    expect(useDesignerStore.getState().params.cutoutToolSets).toBeUndefined();
  });

  it('deepens a floor-anchored fill for the set, keeping its top recess', () => {
    const store = useDesignerStore.getState();
    act(() => {
      store.setParams({ height: 3 });
      store.updateCutoutConfig({ fillReference: 'floor', topOffset: 2 });
    });
    const { result } = renderHook(() => useToolSets());
    act(() => {
      expect(result.current.insertSet({ ...spec, sizes: ['19'] })).toBe('added');
    });
    const { params } = useDesignerStore.getState();
    const fill = binDimensions(params).wallHeight - params.cutoutConfig.topOffset;
    const deepest = Math.max(
      ...params.cutouts.map((c) => Math.max(c.cutDepth, c.split?.cutDepth ?? 0))
    );
    expect(params.cutoutConfig.topOffset).toBe(2);
    expect(fill).toBeGreaterThanOrEqual(deepest + 1);
  });

  it('refuses a set that cannot fit, and changes nothing', () => {
    act(() =>
      useDesignerStore.getState().setParams({
        width: 2,
        depth: 2,
        cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] },
      })
    );
    const before = useDesignerStore.getState().params;
    const { result } = renderHook(() => useToolSets());
    act(() => {
      expect(result.current.insertSet(spec)).toBe('noRoom');
    });
    expect(useDesignerStore.getState().params).toBe(before);
  });

  it('moves a rebuilt set that would grow into its neighbour', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet({ ...spec, sizes: ['8', '10'] });
    });
    const first = onlySetId();
    act(() => {
      result.current.insertSet({ ...spec, sizes: ['8', '10'] });
    });
    const second = Object.keys(useDesignerStore.getState().params.cutoutToolSets ?? {}).find(
      (id) => id !== first
    );
    if (!second) throw new Error('expected a second set');
    act(() => {
      expect(result.current.rebuildSet(first, { ...spec, sizes: ['17', '19', '21', '22'] })).toBe(
        'updated'
      );
    });
    const { cutouts } = useDesignerStore.getState().params;
    const a = cutBoxes(membersOf(cutouts, first));
    const b = cutBoxes(membersOf(cutouts, second));
    expect(a.some((x) => b.some((y) => boxesOverlap(x, y, 0)))).toBe(false);
  });

  it('copies the recipe when a whole set is duplicated, not part of one', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet(spec);
    });
    const setId = onlySetId();
    const ids = membersOf(useDesignerStore.getState().params.cutouts, setId).map((c) => c.id);
    act(() => useDesignerStore.getState().duplicateCutouts(ids.slice(0, 1)));
    expect(Object.keys(useDesignerStore.getState().params.cutoutToolSets ?? {})).toHaveLength(1);
    act(() => useDesignerStore.getState().duplicateCutouts(ids));
    const sets = useDesignerStore.getState().params.cutoutToolSets ?? {};
    expect(Object.keys(sets)).toHaveLength(2);
    expect(Object.values(sets).every((s) => s.sizes.join() === spec.sizes.join())).toBe(true);
  });
});
