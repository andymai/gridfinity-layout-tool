import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { updateEntry } from './updateEntry';
import { makeLibrary, makeEntry } from './_testHelpers';

describe('v2 library.updateEntry', () => {
  it('emits change set for permitted fields', () => {
    const library = makeLibrary();
    const result = updateEntry.handle(
      { layoutId: 'layout_1', updates: { name: 'Renamed' } },
      { aggregate: library }
    );
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.changes).toEqual({ name: 'Renamed' });
  });

  it('truncates name to NAME_MAX_LENGTH inside handle', () => {
    const library = makeLibrary();
    const long = 'x'.repeat(CONSTRAINTS.NAME_MAX_LENGTH + 50);
    const result = updateEntry.handle(
      { layoutId: 'layout_1', updates: { name: long } },
      { aggregate: library }
    );
    if (!isOk(result)) throw new Error('handle failed');
    const truncated = (result.value.event.payload.changes as { name?: string }).name;
    expect(truncated?.length).toBe(CONSTRAINTS.NAME_MAX_LENGTH);
  });

  it('errors when the entry does not exist', () => {
    const library = makeLibrary();
    const result = updateEntry.handle(
      { layoutId: 'layout_gone', updates: { name: 'X' } },
      { aggregate: library }
    );
    expect(result.ok).toBe(false);
  });

  it('apply() Object.assigns the changes onto the matching entry', () => {
    const library = makeLibrary({
      entries: [makeEntry('layout_1', 'Original')],
    });
    const result = updateEntry.handle(
      { layoutId: 'layout_1', updates: { name: 'Renamed' } },
      { aggregate: library }
    );
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(library, (draft) => {
      updateEntry.apply(
        { type: 'library.entryUpdated', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.entries[0].name).toBe('Renamed');
  });
});
