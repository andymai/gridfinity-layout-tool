import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { layoutId } from '@/core/types';
import { deleteEntry } from './deleteEntry';
import { makeLibrary, makeEntry } from './_testHelpers';

describe('v2 library.deleteEntry', () => {
  it('rejects deleting the last remaining entry', () => {
    const library = makeLibrary(); // single entry
    const result = deleteEntry.handle({ layoutId: 'layout_1' }, { aggregate: library });
    expect(result.ok).toBe(false);
  });

  it('apply() filters the entry out of the draft', () => {
    const library = makeLibrary({
      entries: [makeEntry('layout_1'), makeEntry('layout_2')],
    });
    const result = deleteEntry.handle({ layoutId: 'layout_1' }, { aggregate: library });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(library, (draft) => {
      deleteEntry.apply(
        { type: 'library.entryDeleted', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.entries).toHaveLength(1);
    expect(applied.entries[0].id).toBe(layoutId('layout_2'));
  });

  it('apply() advances activeLayoutId when the deleted entry was active', () => {
    const library = makeLibrary({
      activeLayoutId: layoutId('layout_1'),
      entries: [makeEntry('layout_1'), makeEntry('layout_2')],
    });
    const result = deleteEntry.handle({ layoutId: 'layout_1' }, { aggregate: library });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(library, (draft) => {
      deleteEntry.apply(
        { type: 'library.entryDeleted', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.activeLayoutId).toBe(layoutId('layout_2'));
  });
});
