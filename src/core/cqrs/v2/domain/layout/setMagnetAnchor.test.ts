import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { setMagnetAnchor } from './setMagnetAnchor';
import { makeLayout } from './_testHelpers';

describe('v2 layout.setMagnetAnchor', () => {
  it('captures previousAnchor, defaulting an unset layout to edge', () => {
    const layout = makeLayout();
    const result = setMagnetAnchor.handle({ anchor: 'center' }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.previousAnchor).toBe('edge');
    expect(result.value.event.payload.anchor).toBe('center');
  });

  it('apply() updates magnetAnchor', () => {
    const layout = makeLayout();
    const result = setMagnetAnchor.handle({ anchor: 'center' }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      setMagnetAnchor.apply(
        { type: 'layout.magnetAnchorSet', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.magnetAnchor).toBe('center');
  });

  it('captures the prior anchor for undo when already set', () => {
    const layout = produce(makeLayout(), (draft) => {
      draft.magnetAnchor = 'center';
    });
    const result = setMagnetAnchor.handle({ anchor: 'edge' }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.previousAnchor).toBe('center');
  });
});
