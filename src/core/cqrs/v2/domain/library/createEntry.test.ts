import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { createEntry } from './createEntry';
import { makeLibrary } from './_testHelpers';

describe('v2 library.createEntry', () => {
  it('emits an event carrying the full new entry', () => {
    const library = makeLibrary();
    const result = createEntry.handle({ name: 'My Layout' }, { aggregate: library });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.name).toBe('My Layout');
    expect(result.value.event.payload.entry).toBeDefined();
    expect(result.value.event.payload.entry?.id).toBe(result.value.value);
  });

  it('uses provided layoutId when supplied', () => {
    const library = makeLibrary();
    const result = createEntry.handle({ name: 'X', layoutId: 'my_id' }, { aggregate: library });

    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.value).toBe('my_id');
  });

  it('falls back to library.settings.authorName when payload omits author', () => {
    const library = makeLibrary({ settings: { authorName: 'Ada' } });
    const result = createEntry.handle({ name: 'X' }, { aggregate: library });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.entry?.author).toBe('Ada');
  });

  it('apply() pushes the new entry onto the draft', () => {
    const library = makeLibrary();
    const result = createEntry.handle({ name: 'X' }, { aggregate: library });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(library, (draft) => {
      createEntry.apply(
        { type: 'library.entryCreated', payload: result.value.event.payload },
        draft
      );
    });

    expect(applied.entries).toHaveLength(2);
    expect(applied.entries[1]).toEqual(result.value.event.payload.entry);
  });
});
