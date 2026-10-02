import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import type { Layout } from '@/core/types';
import { setLowProfileBase } from './setLowProfileBase';
import { makeLayout } from './_testHelpers';

function applyEnabled(layout: Layout, enabled: boolean): Layout {
  const result = setLowProfileBase.handle({ enabled }, { aggregate: layout });
  if (!isOk(result)) throw new Error('handle failed');
  return produce(layout, (draft) => {
    setLowProfileBase.apply(
      { type: 'layout.lowProfileBaseSet', payload: result.value.event.payload },
      draft
    );
  });
}

describe('v2 layout.setLowProfileBase', () => {
  it('reads an unset layout as standard for undo', () => {
    const result = setLowProfileBase.handle({ enabled: true }, { aggregate: makeLayout() });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload).toEqual({ enabled: true, previousEnabled: false });
  });

  it('stores true when enabled', () => {
    expect(applyEnabled(makeLayout(), true).lowProfileBase).toBe(true);
  });

  it('removes the field rather than storing false', () => {
    const low = applyEnabled(makeLayout(), true);
    const standard = applyEnabled(low, false);
    expect('lowProfileBase' in standard).toBe(false);
  });
});
