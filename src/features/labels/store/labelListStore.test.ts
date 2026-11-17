import { beforeEach, describe, expect, it } from 'vitest';
import {
  LABEL_COPIES_MAX,
  LABEL_DETAIL_MAX_LENGTH,
  LABEL_LIST_MAX,
  LABEL_LIST_STORAGE_KEY,
  useLabelListStore,
} from './labelListStore';

const initial = useLabelListStore.getState();

beforeEach(() => {
  localStorage.clear();
  useLabelListStore.setState(initial, true);
});

describe('useLabelListStore', () => {
  it('adds pasted rows with one copy each, up to the list cap', () => {
    const { addEntries } = useLabelListStore.getState();

    expect(addEntries([{ name: 'Nuts', detail: 'M3' }])).toBe(1);
    const many = Array.from({ length: LABEL_LIST_MAX }, (_, i) => ({ name: `L${i}`, detail: '' }));
    expect(addEntries(many)).toBe(LABEL_LIST_MAX - 1);
    expect(addEntries(many)).toBe(0);

    const { entries } = useLabelListStore.getState();
    expect(entries).toHaveLength(LABEL_LIST_MAX);
    expect(entries[0]).toMatchObject({ name: 'Nuts', detail: 'M3', copies: 1 });
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(LABEL_LIST_MAX);
  });

  it('clamps copies and trims long text on update', () => {
    const store = useLabelListStore.getState();
    store.addEntries([{ name: 'Nuts', detail: '' }]);
    const { id } = useLabelListStore.getState().entries[0];

    store.updateEntry(id, { copies: 500, detail: 'x'.repeat(100) });
    expect(useLabelListStore.getState().entries[0]).toMatchObject({
      copies: LABEL_COPIES_MAX,
      detail: 'x'.repeat(LABEL_DETAIL_MAX_LENGTH),
      name: 'Nuts',
    });
    store.updateEntry(id, { copies: 0 });
    expect(useLabelListStore.getState().entries[0].copies).toBe(1);
  });

  it('removes one row or clears the list', () => {
    const store = useLabelListStore.getState();
    store.addEntries([
      { name: 'A', detail: '' },
      { name: 'B', detail: '' },
    ]);
    store.removeEntry(useLabelListStore.getState().entries[0].id);
    expect(useLabelListStore.getState().entries.map((entry) => entry.name)).toEqual(['B']);
    store.clearEntries();
    expect(useLabelListStore.getState().entries).toEqual([]);
  });

  it('restores a saved list and drops malformed values', async () => {
    localStorage.setItem(
      LABEL_LIST_STORAGE_KEY,
      JSON.stringify({
        state: {
          entries: [{ id: 'a', name: 'Nuts', copies: 3 }, { name: 'no id' }, 'junk'],
          printerId: 'zebra',
          mediaId: '12x40',
          tapeLength: 7,
        },
        version: 0,
      })
    );
    await useLabelListStore.persist.rehydrate();

    const state = useLabelListStore.getState();
    expect(state.entries).toEqual([{ id: 'a', name: 'Nuts', detail: '', copies: 3 }]);
    expect(state.printerId).toBe('brother-pt');
    expect(state.mediaId).toBe('12x40');
    expect(state.tapeLength).toBe('fit');
  });
});
