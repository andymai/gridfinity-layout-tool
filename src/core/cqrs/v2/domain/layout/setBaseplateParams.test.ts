import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import type { StoredBaseplateParams } from '@/core/types';
import { setBaseplateParams } from './setBaseplateParams';
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

describe('v2 layout.setBaseplateParams', () => {
  it('clamps padding values to >= 0', () => {
    const layout = makeLayout();
    const params: StoredBaseplateParams = {
      ...baseParams,
      paddingLeft: -5 as StoredBaseplateParams['paddingLeft'],
    };
    const result = setBaseplateParams.handle({ params }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.params.paddingLeft).toBe(0);
  });

  it('clamps magnetDiameter to [0.5, 20]', () => {
    const layout = makeLayout();
    const params: StoredBaseplateParams = {
      ...baseParams,
      magnetDiameter: 999 as StoredBaseplateParams['magnetDiameter'],
    };
    const result = setBaseplateParams.handle({ params }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.params.magnetDiameter).toBe(20);
  });

  it('captures previousParams when present', () => {
    const layout = makeLayout({ baseplateParams: baseParams });
    const result = setBaseplateParams.handle(
      { params: { ...baseParams, magnetHoles: true } },
      { aggregate: layout }
    );
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.previousParams).toEqual(baseParams);
  });

  it('preserves paddingAnchor through the handler', () => {
    const layout = makeLayout();
    const params: StoredBaseplateParams = { ...baseParams, paddingAnchor: 'tr' };
    const result = setBaseplateParams.handle({ params }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.params.paddingAnchor).toBe('tr');
  });

  it('apply() installs the new params', () => {
    const layout = makeLayout();
    const result = setBaseplateParams.handle({ params: baseParams }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      setBaseplateParams.apply(
        { type: 'layout.baseplateParamsSet', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.baseplateParams).toEqual(result.value.event.payload.params);
  });
});
