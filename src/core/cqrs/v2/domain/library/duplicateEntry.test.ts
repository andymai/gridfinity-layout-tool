import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { duplicateEntry } from './duplicateEntry';
import { makeLibrary, makeEntry } from './_testHelpers';

describe('v2 library.duplicateEntry', () => {
  it('emits an event with a new entry derived from the source', () => {
    const library = makeLibrary({
      entries: [makeEntry('layout_1', 'Original')],
    });
    const result = duplicateEntry.handle({ sourceLayoutId: 'layout_1' }, { aggregate: library });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.sourceLayoutId).toBe('layout_1');
    expect(result.value.event.payload.entry.name).toBe('Original (copy)');
    expect(result.value.event.payload.entry.id).toBe(result.value.event.payload.newLayoutId);
  });

  it('errors when the source entry does not exist', () => {
    const library = makeLibrary();
    const result = duplicateEntry.handle({ sourceLayoutId: 'layout_gone' }, { aggregate: library });
    expect(result.ok).toBe(false);
  });

  it('apply() pushes the duplicated entry onto the draft', () => {
    const library = makeLibrary({ entries: [makeEntry('layout_1')] });
    const result = duplicateEntry.handle({ sourceLayoutId: 'layout_1' }, { aggregate: library });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(library, (draft) => {
      duplicateEntry.apply(
        { type: 'library.entryDuplicated', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.entries).toHaveLength(2);
    expect(applied.entries[1]).toEqual(result.value.event.payload.entry);
  });
});
