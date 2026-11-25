import { beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk } from '@/core/result';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { SHARED_PREVIEW_ID } from '@/core/constants';
import type { LayoutId } from '@/core/types';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { binId, gridUnits, heightUnits, layerId } from '@/core/types';
import type { Layout } from '@/core/types';
import { createTestLayout, resetHistoryStore, resetLayoutStore } from '@/test/testUtils';
import { _resetUndoCaptureState } from '../../../middleware/undoCapture';
import { commandBus } from '../../../bus/commandBus';
import { eventBus } from '../../../bus/eventBus';
import { createCqrsMutations } from '../../../integration/mutationsAdapter';
import { applyEvent } from '../../../projection/replay';
import { layoutRevision } from '../../../changeSet';
import type { ChangeOp, ChangeSet } from '../../../changeSet';
import type { DomainEvent } from '../../../events';

const start: Layout = createTestLayout({
  bins: [
    {
      id: binId('a'),
      layerId: layerId('layer1'),
      x: gridUnits(0),
      y: gridUnits(0),
      width: gridUnits(2),
      depth: gridUnits(2),
      height: heightUnits(3),
      category: createTestLayout().categories[0].id,
      label: 'A',
      notes: '',
    },
  ],
});

const set = (ops: ChangeOp[], layout: Layout = start): ChangeSet => ({
  v: 1,
  layoutId: 'layout-1',
  baseRev: layoutRevision(layout),
  summary: 'Add a pliers bin',
  ops,
});

const ADD_TWO: ChangeOp[] = [
  { op: 'addCategory', ref: 'tools', name: 'Tools' },
  {
    op: 'addBin',
    ref: 'pliers',
    layer: { id: 'layer1' },
    x: 2,
    y: 0,
    width: 2,
    depth: 2,
    height: 3,
    label: 'Pliers',
    category: { ref: 'tools' },
  },
  { op: 'updateBin', bin: { id: 'a' }, set: { label: 'Screws' } },
];

const setActive = (id: string): void => {
  useLibraryStore.setState({
    library: { ...useLibraryStore.getState().library, activeLayoutId: id as LayoutId },
  });
};

describe('layout.applyChangeSet through the bus', () => {
  const mutations = createCqrsMutations(commandBus);
  const captured: DomainEvent[] = [];

  beforeEach(() => {
    resetLayoutStore();
    resetHistoryStore();
    _resetUndoCaptureState();
    useLayoutStore.setState({ layout: start });
    setActive('layout-1');
    captured.length = 0;
  });

  it('applies every op as one undo step, labelled, and returns the new ids', () => {
    const unsubscribe = eventBus.subscribe('layout.changeSetApplied', (event) => {
      captured.push(event);
    });
    const result = mutations.applyChangeSet(set(ADD_TWO));
    unsubscribe();

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const after = useLayoutStore.getState().layout;
    expect(after.bins.find((b) => b.id === result.value.refs.pliers)).toMatchObject({
      label: 'Pliers',
      category: result.value.refs.tools,
    });
    expect(after.bins.find((b) => b.id === 'a')?.label).toBe('Screws');
    expect(useLayoutStore.getState().lastEditSource).toBe('local');

    const { past } = useHistoryStore.getState();
    expect(past).toHaveLength(1);
    expect(past[0].commandType).toBe('layout.applyChangeSet');
    expect(past[0].layout).toEqual(start);

    // Replay from the one event gives the same layout, ids included.
    expect(captured).toHaveLength(1);
    expect(applyEvent(start, captured[0])).toEqual(after);
  });

  it('applies a set that adds a bin and then edits and stashes it', () => {
    const result = mutations.applyChangeSet(
      set([
        {
          op: 'addBin',
          ref: 'n',
          layer: { id: 'layer1' },
          x: 4,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
        },
        { op: 'updateBin', bin: { ref: 'n' }, set: { label: 'Later' } },
        { op: 'stashBin', bin: { ref: 'n' } },
      ])
    );
    if (!isOk(result)) throw new Error(JSON.stringify(result.error));
    const added = useLayoutStore.getState().layout.bins.find((b) => b.id === result.value.refs.n);
    expect(added).toMatchObject({ label: 'Later', layerId: '__staging__' });
  });

  it('refuses a set for another layout with the same content, such as a duplicate', () => {
    setActive('layout-copy');
    expect(isErr(mutations.applyChangeSet(set(ADD_TWO)))).toBe(true);
    expect(useLayoutStore.getState().layout).toEqual(start);
    setActive(SHARED_PREVIEW_ID);
    expect(isErr(mutations.applyChangeSet({ ...set(ADD_TWO), layoutId: SHARED_PREVIEW_ID }))).toBe(
      true
    );
    expect(useHistoryStore.getState().past).toHaveLength(0);
  });

  it('refuses a set made for an older layout, and changes nothing', () => {
    const stale = set(ADD_TWO, createTestLayout());
    const result = mutations.applyChangeSet(stale);
    expect(isErr(result)).toBe(true);
    expect(useLayoutStore.getState().layout).toEqual(start);
    expect(useHistoryStore.getState().past).toHaveLength(0);
  });

  it('applies nothing when a later op fails', () => {
    const result = mutations.applyChangeSet(
      set([
        ...ADD_TWO,
        { op: 'addBin', layer: { id: 'layer1' }, x: 0, y: 0, width: 2, depth: 2, height: 3 },
      ])
    );
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(JSON.stringify(result.error)).toContain('Change 4 (addBin)');
    expect(useLayoutStore.getState().layout).toEqual(start);
    expect(useHistoryStore.getState().past).toHaveLength(0);
  });

  it('rejects a malformed set before the handler runs', () => {
    const result = mutations.applyChangeSet({ ...set(ADD_TWO), ops: [] });
    expect(isErr(result)).toBe(true);
    expect(useLayoutStore.getState().layout).toEqual(start);
  });
});
