import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { setName } from './setName';
import { makeLayout } from './_testHelpers';

describe('v2 layout.setName', () => {
  it('captures previousName + sets new name', () => {
    const layout = makeLayout({ name: 'Old' });
    const result = setName.handle({ name: 'New' }, { aggregate: layout });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload).toEqual({ name: 'New', previousName: 'Old' });
  });

  it('truncates names longer than NAME_MAX_LENGTH', () => {
    const layout = makeLayout();
    const long = 'x'.repeat(CONSTRAINTS.NAME_MAX_LENGTH + 50);
    const result = setName.handle({ name: long }, { aggregate: layout });

    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.name.length).toBe(CONSTRAINTS.NAME_MAX_LENGTH);
  });

  it('apply() sets the layout name', () => {
    const layout = makeLayout({ name: 'Old' });
    const result = setName.handle({ name: 'New' }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      setName.apply({ type: 'layout.nameSet', payload: result.value.event.payload }, draft);
    });
    expect(applied.name).toBe('New');
  });
});
