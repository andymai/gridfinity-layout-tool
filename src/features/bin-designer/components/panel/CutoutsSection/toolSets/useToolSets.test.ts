import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { ToolSetSpec } from '@/features/bin-designer/types';
import { getRotatedBounds } from '../geometryCore';
import { binBoard } from '../packIntoBin';
import { checkPockets } from '../pocketChecks';
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
});
