import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { setAuthorName } from './setAuthorName';
import { makeLibrary } from './_testHelpers';

describe('v2 library.setAuthorName', () => {
  it('captures previousName from settings', () => {
    const library = makeLibrary({ settings: { authorName: 'Old' } });
    const result = setAuthorName.handle({ name: 'New' }, { aggregate: library });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload).toEqual({ name: 'New', previousName: 'Old' });
  });

  it('falls back to empty string when no previous authorName', () => {
    const library = makeLibrary();
    const result = setAuthorName.handle({ name: 'New' }, { aggregate: library });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.previousName).toBe('');
  });

  it('truncates name to NAME_MAX_LENGTH inside handle', () => {
    const library = makeLibrary();
    const long = 'x'.repeat(CONSTRAINTS.NAME_MAX_LENGTH + 50);
    const result = setAuthorName.handle({ name: long }, { aggregate: library });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.name.length).toBe(CONSTRAINTS.NAME_MAX_LENGTH);
  });

  it('apply() sets settings.authorName on the draft', () => {
    const library = makeLibrary();
    const result = setAuthorName.handle({ name: 'Ada' }, { aggregate: library });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(library, (draft) => {
      setAuthorName.apply(
        { type: 'library.authorNameSet', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.settings.authorName).toBe('Ada');
  });
});
