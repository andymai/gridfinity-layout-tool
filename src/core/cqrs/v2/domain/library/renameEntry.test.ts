import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { renameEntry } from './renameEntry';
import { makeLibrary, makeEntry } from './_testHelpers';

describe('v2 library.renameEntry', () => {
  it('captures previousName from the existing entry', () => {
    const library = makeLibrary({
      entries: [makeEntry('layout_1', 'Old')],
    });
    const result = renameEntry.handle(
      { layoutId: 'layout_1', name: 'New' },
      { aggregate: library }
    );

    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload).toEqual({
      layoutId: 'layout_1',
      name: 'New',
      previousName: 'Old',
    });
  });

  it('previousName is empty string when the entry does not exist', () => {
    const library = makeLibrary();
    const result = renameEntry.handle(
      { layoutId: 'layout_gone', name: 'X' },
      { aggregate: library }
    );
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.previousName).toBe('');
  });

  it('truncates name to NAME_MAX_LENGTH inside handle', () => {
    const library = makeLibrary();
    const long = 'x'.repeat(CONSTRAINTS.NAME_MAX_LENGTH + 50);
    const result = renameEntry.handle({ layoutId: 'layout_1', name: long }, { aggregate: library });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.name.length).toBe(CONSTRAINTS.NAME_MAX_LENGTH);
  });

  it('apply() sets the entry name on the draft', () => {
    const library = makeLibrary({
      entries: [makeEntry('layout_1', 'Original')],
    });
    const result = renameEntry.handle(
      { layoutId: 'layout_1', name: 'Renamed' },
      { aggregate: library }
    );
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(library, (draft) => {
      renameEntry.apply(
        { type: 'library.entryRenamed', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.entries[0].name).toBe('Renamed');
  });
});
