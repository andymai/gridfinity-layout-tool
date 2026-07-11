import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import type { StoredBaseplateParams } from '@/core/types';
import { baseplateDesignId } from '@/core/types';
import { setActiveBaseplate } from './setActiveBaseplate';
import { makeLayout } from './_testHelpers';

const baseParams: StoredBaseplateParams = {
  magnetHoles: false,
  magnetDiameter: 6 as StoredBaseplateParams['magnetDiameter'],
  magnetDepth: 2 as StoredBaseplateParams['magnetDepth'],
  paddingLeft: 0 as StoredBaseplateParams['paddingLeft'],
  paddingRight: 0 as StoredBaseplateParams['paddingRight'],
  paddingFront: 0 as StoredBaseplateParams['paddingFront'],
  paddingBack: 0 as StoredBaseplateParams['paddingBack'],
};

const nextParams: StoredBaseplateParams = { ...baseParams, magnetHoles: true };

describe('v2 layout.setActiveBaseplate', () => {
  it('apply() sets both activeBaseplateId and baseplateParams', () => {
    const layout = makeLayout();
    const result = setActiveBaseplate.handle(
      { designId: 'baseplate_1', params: nextParams },
      { aggregate: layout }
    );
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      setActiveBaseplate.apply(
        { type: 'layout.activeBaseplateSet', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.activeBaseplateId).toBe('baseplate_1');
    expect(applied.baseplateParams).toEqual(nextParams);
  });

  it('captures previousActiveBaseplateId + previousParams for undo', () => {
    const previousId = baseplateDesignId('baseplate_prev');
    const layout = makeLayout({ activeBaseplateId: previousId, baseplateParams: baseParams });
    const result = setActiveBaseplate.handle(
      { designId: 'baseplate_new', params: nextParams },
      { aggregate: layout }
    );
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.previousActiveBaseplateId).toBe(previousId);
    expect(result.value.event.payload.previousParams).toEqual(baseParams);
  });

  it('captures null previous id when the layout had no active baseplate', () => {
    const layout = makeLayout({ baseplateParams: baseParams });
    const result = setActiveBaseplate.handle(
      { designId: 'baseplate_new', params: nextParams },
      { aggregate: layout }
    );
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.previousActiveBaseplateId).toBeNull();
  });

  it('supports orphaning to a null pointer while keeping params', () => {
    const previousId = baseplateDesignId('baseplate_prev');
    const layout = makeLayout({ activeBaseplateId: previousId, baseplateParams: baseParams });
    const result = setActiveBaseplate.handle(
      { designId: null, params: baseParams },
      { aggregate: layout }
    );
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      setActiveBaseplate.apply(
        { type: 'layout.activeBaseplateSet', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.activeBaseplateId).toBeNull();
    expect(applied.baseplateParams).toEqual(baseParams);
  });

  it('rejects an empty-string designId via its validation schema', () => {
    const parsed = setActiveBaseplate.payload.safeParse({ designId: '', params: nextParams });
    expect(parsed.success).toBe(false);
  });
});
