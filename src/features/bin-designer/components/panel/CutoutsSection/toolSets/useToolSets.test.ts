import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { err, ok } from '@/core/result';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { Cutout, ToolSetSpec } from '@/features/bin-designer/types';
import { getRotatedBounds } from '../geometryCore';
import { binBoard } from '../packIntoBin';
import { checkPockets } from '../pocketChecks';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { cloneCutoutsWithGroups } from '../cutoutHelpers';
import { boxesOverlap, cutBoxes } from './planToolSetPlacement';
import { partsOf, withoutPart } from '@/features/bin-designer/utils/toolSetMembership';
import { migrateParams } from '@/features/bin-designer/constants/paramMigration';
import { useToolSets } from './useToolSets';

const spec: ToolSetSpec = {
  family: 'combinationWrench',
  units: 'metric',
  sizes: ['8', '10', '13'],
  style: 'flat',
  clearanceMm: 0.4,
  labelSizeMm: 5,
  fingerChannel: true,
};

function circle(id: string): Cutout {
  return {
    id,
    shape: 'circle',
    x: 1,
    y: 1,
    width: 10,
    depth: 10,
    cutDepth: 3,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
  };
}

function partsIn(setId: string): Cutout[] {
  const { params } = useDesignerStore.getState();
  return partsOf(params.cutouts, setId, params.cutoutToolSets);
}

function onlySetId(): string {
  const ids = Object.keys(useDesignerStore.getState().params.cutoutToolSets ?? {});
  expect(ids).toHaveLength(1);
  return ids[0];
}

describe('useToolSets', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('adds a set as one container with its spec, in one undo step', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      expect(result.current.insertSet(spec)).toEqual(ok('added'));
    });
    const { params } = useDesignerStore.getState();
    const setId = onlySetId();
    const members = partsIn(setId);
    expect(members.length).toBe(params.cutouts.length);
    expect(members.filter((c) => c.shape === 'path')).toHaveLength(3);
    expect(params.cutoutToolSets?.[setId]).toEqual(spec);
    expect(params.cutoutGroupNames?.[setId]).toBeUndefined();

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
    const before = partsIn(setId);
    const oldLeft = Math.min(...before.map((c) => getRotatedBounds(c).minX - (c.clearance ?? 0)));
    const idOf = (parts: Cutout[], part: string) => parts.find((c) => c.toolSetPart === part)?.id;
    const next = { ...spec, sizes: ['8', '10', '13', '17'] };
    act(() => {
      expect(result.current.rebuildSet(setId, next)).toEqual(ok('updated'));
    });
    const { params } = useDesignerStore.getState();
    const members = partsIn(setId);
    expect(members.filter((c) => c.shape === 'path')).toHaveLength(4);
    expect(params.cutoutToolSets?.[setId]).toEqual(next);
    expect(idOf(members, 'pocket:8')).toBe(idOf(before, 'pocket:8'));
    expect(idOf(members, 'channel')).toBe(idOf(before, 'channel'));
    expect(idOf(members, 'pocket:17')).toBeDefined();
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
      expect(result.current.insertSet({ ...spec, sizes: ['19'] })).toEqual(ok('added'));
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
      expect(result.current.insertSet(spec)).toEqual(err('noRoom'));
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
      expect(
        result.current.rebuildSet(first, { ...spec, sizes: ['17', '19', '21', '22'] })
      ).toEqual(ok('updated'));
    });
    const { cutouts } = useDesignerStore.getState().params;
    const sets = useDesignerStore.getState().params.cutoutToolSets;
    const a = cutBoxes(partsOf(cutouts, first, sets));
    const b = cutBoxes(partsOf(cutouts, second, sets));
    expect(a.some((x) => b.some((y) => boxesOverlap(x, y, 0)))).toBe(false);
  });

  it('copies the recipe when a whole set is duplicated, not part of one', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet(spec);
    });
    const setId = onlySetId();
    const ids = partsIn(setId).map((c) => c.id);
    act(() => useDesignerStore.getState().duplicateCutouts(ids.slice(0, 1)));
    expect(Object.keys(useDesignerStore.getState().params.cutoutToolSets ?? {})).toHaveLength(1);
    const loose = useDesignerStore.getState().params.cutouts.filter((c) => !ids.includes(c.id));
    expect(loose.map((c) => c.toolSetPart)).toEqual([undefined]);

    act(() => useDesignerStore.getState().duplicateCutouts(ids));
    const sets = useDesignerStore.getState().params.cutoutToolSets ?? {};
    expect(Object.keys(sets)).toHaveLength(2);
    expect(Object.values(sets).every((s) => s.sizes.join() === spec.sizes.join())).toBe(true);
    const copy = Object.keys(sets).find((id) => id !== setId) ?? '';
    expect(partsIn(copy)).toHaveLength(ids.length);
  });

  it('gives a pasted copy of a whole set its own recipe', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet(spec);
    });
    const setId = onlySetId();
    const store = useDesignerStore.getState();
    const members = partsIn(setId);
    const clones = cloneCutoutsWithGroups(members, (c) => ({ x: c.x + 5, y: c.y + 5 }));
    act(() => {
      for (const { originalId: _, ...clone } of clones) store.addCutout(clone);
      store.copyToolSetsForClones(clones.map((c) => [c.originalId, c.id] as const));
    });
    const sets = Object.keys(useDesignerStore.getState().params.cutoutToolSets ?? {});
    expect(sets).toHaveLength(2);
    expect(partsIn(sets.find((id) => id !== setId) ?? '')).toHaveLength(members.length);
  });

  it('pastes a pocket copied without its set as the user own shape', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet(spec);
    });
    const store = useDesignerStore.getState();
    const [pocket] = partsIn(onlySetId());
    const [clone] = cloneCutoutsWithGroups([pocket], (c) => ({ x: c.x + 5, y: c.y + 5 }));
    act(() => {
      const { originalId: _, ...copy } = clone;
      store.addCutout(copy);
      store.copyToolSetsForClones([[clone.originalId, clone.id]]);
    });
    const pasted = useDesignerStore.getState().params.cutouts.find((c) => c.id === clone.id);
    expect(pasted).toBeDefined();
    expect(pasted?.toolSetPart).toBeUndefined();
  });

  it('lets a pocket moved into another set stay through that set rebuild', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet({ ...spec, sizes: ['8'] });
      result.current.insertSet({ ...spec, sizes: ['10'] });
    });
    const [a, b] = Object.keys(useDesignerStore.getState().params.cutoutToolSets ?? {});
    const moved = partsIn(a).find((c) => c.shape === 'path');
    const target = partsIn(b).find((c) => c.shape === 'path');
    if (!moved || !target) throw new Error('expected pockets');
    act(() => useDesignerStore.getState().reparentCutouts([moved.id], target.id));
    const after = useDesignerStore.getState().params.cutouts.find((c) => c.id === moved.id);
    expect(after?.toolSetPart).toBeUndefined();

    act(() => {
      result.current.rebuildSet(b, { ...spec, sizes: ['10', '13'] });
    });
    expect(useDesignerStore.getState().params.cutouts.some((c) => c.id === moved.id)).toBe(true);
  });

  it('rebuilds a set with no parts left under the same id, keeping the user shapes', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet(spec);
    });
    const setId = onlySetId();
    act(() => {
      const store = useDesignerStore.getState();
      store.addCutout({ ...circle('mine'), parentGroups: [setId] });
      store.removeCutoutsBatch(partsIn(setId).map((c) => c.id));
    });
    act(() => {
      expect(result.current.rebuildSet(setId, spec)).toEqual(ok('updated'));
    });
    expect(onlySetId()).toBe(setId);
    expect(partsIn(setId).filter((c) => c.shape === 'path')).toHaveLength(3);
    expect(useDesignerStore.getState().params.cutouts.some((c) => c.id === 'mine')).toBe(true);
  });

  it('keeps a text the user left in a set with no parts, across a reload', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet(spec);
    });
    const setId = onlySetId();
    act(() => {
      const store = useDesignerStore.getState();
      store.addCutout({ ...circle('note'), shape: 'text', label: 'Spares', parentGroups: [setId] });
      store.removeCutoutsBatch(partsIn(setId).map((c) => c.id));
    });
    act(() =>
      useDesignerStore.setState({ params: migrateParams(useDesignerStore.getState().params) })
    );
    act(() => {
      result.current.rebuildSet(setId, spec);
    });
    expect(useDesignerStore.getState().params.cutouts.some((c) => c.id === 'note')).toBe(true);
  });

  it('rebuilds a set saved before parts existed, once the design is loaded', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet(spec);
    });
    const setId = onlySetId();
    const { params } = useDesignerStore.getState();
    const firstRelease = {
      ...params,
      cutouts: params.cutouts.map(withoutPart),
      cutoutGroupNames: { [setId]: 'Wrenches 8 to 13 mm' },
    };
    act(() => useDesignerStore.setState({ params: migrateParams(firstRelease) }));
    act(() => {
      result.current.rebuildSet(setId, { ...spec, sizes: ['8', '10'] });
    });
    const after = useDesignerStore.getState().params;
    expect(Object.keys(after.cutoutToolSets ?? {})).toEqual([setId]);
    expect(after.cutouts.filter((c) => c.shape === 'path')).toHaveLength(2);
    expect(after.cutoutGroupNames?.[setId]).toBeUndefined();
  });

  it('gives a copy pasted into the lid no recipe, since sets are bin-only', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet(spec);
    });
    const members = partsIn(onlySetId());
    const clones = cloneCutoutsWithGroups(members, (c) => ({ x: c.x, y: c.y }));
    act(() => {
      const store = useDesignerStore.getState();
      store.setCutoutEditorOpen(true, 'lid');
      for (const { originalId: _, ...clone } of clones) store.addCutout(clone);
      store.copyToolSetsForClones(clones.map((c) => [c.originalId, c.id] as const));
    });
    expect(Object.keys(useDesignerStore.getState().params.cutoutToolSets ?? {})).toHaveLength(1);
  });

  it('keeps the name of a container that holds only the set, across a rebuild', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet(spec);
    });
    const setId = onlySetId();
    act(() => {
      const { params } = useDesignerStore.getState();
      useDesignerStore.setState({
        params: {
          ...params,
          cutouts: params.cutouts.map((c) => ({ ...c, parentGroups: ['outer', setId] })),
          cutoutGroupNames: { ...params.cutoutGroupNames, outer: 'Drawer A' },
        },
      });
    });
    act(() => {
      result.current.rebuildSet(setId, { ...spec, sizes: ['8', '10'] });
    });
    const { params } = useDesignerStore.getState();
    expect(params.cutoutGroupNames?.outer).toBe('Drawer A');
    expect(params.cutouts.every((c) => c.parentGroups?.[0] === 'outer')).toBe(true);
  });

  it('drops a name stored by the first release, so it follows the new sizes', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet(spec);
    });
    const setId = onlySetId();
    act(() => useDesignerStore.getState().setCutoutGroupName(setId, 'Wrenches 8 to 13 mm'));
    act(() => {
      result.current.rebuildSet(setId, { ...spec, sizes: ['10'] });
    });
    expect(useDesignerStore.getState().params.cutoutGroupNames?.[setId]).toBeUndefined();
  });

  it('keeps a shape the user dragged into the set across a rebuild', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet(spec);
    });
    const setId = onlySetId();
    const extra: Cutout = { ...circle('mine'), parentGroups: [setId] };
    act(() => {
      useDesignerStore.getState().addCutout(extra);
    });
    act(() => {
      result.current.rebuildSet(setId, { ...spec, sizes: ['8', '10'] });
    });
    const kept = useDesignerStore.getState().params.cutouts.find((c) => c.id === 'mine');
    expect(kept?.parentGroups).toEqual([setId]);
  });

  it('refuses to rebuild a set with a locked pocket, and changes nothing', () => {
    const { result } = renderHook(() => useToolSets());
    act(() => {
      result.current.insertSet(spec);
    });
    const setId = onlySetId();
    const pocket = partsIn(setId).find((c) => c.shape === 'path');
    if (!pocket) throw new Error('expected a pocket');
    act(() => useDesignerStore.getState().setCutoutProperty([pocket.id], { locked: true }));
    const before = useDesignerStore.getState().params;
    act(() => {
      expect(result.current.rebuildSet(setId, { ...spec, sizes: ['10'] })).toEqual(err('locked'));
    });
    expect(useDesignerStore.getState().params).toBe(before);
  });
});
