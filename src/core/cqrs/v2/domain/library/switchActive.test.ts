import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { layoutId } from '@/core/types';
import { switchActive } from './switchActive';
import { makeLibrary } from './_testHelpers';

describe('v2 library.switchActive', () => {
  it('captures previousLayoutId in the event', () => {
    const library = makeLibrary({ activeLayoutId: layoutId('layout_1') });
    const result = switchActive.handle({ layoutId: 'layout_2' }, { aggregate: library });

    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.previousLayoutId).toBe(layoutId('layout_1'));
    expect(result.value.event.payload.newLayoutId).toBe(layoutId('layout_2'));
  });

  it('apply() sets activeLayoutId on the draft', () => {
    const library = makeLibrary({ activeLayoutId: layoutId('layout_1') });
    const result = switchActive.handle({ layoutId: 'layout_2' }, { aggregate: library });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(library, (draft) => {
      switchActive.apply(
        { type: 'library.activeLayoutSwitched', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.activeLayoutId).toBe(layoutId('layout_2'));
  });
});
