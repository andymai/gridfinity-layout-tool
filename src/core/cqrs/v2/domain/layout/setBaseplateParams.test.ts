import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import type { BaseplateParams } from '@/core/types';
import { setBaseplateParams } from './setBaseplateParams';
import { makeLayout } from './_testHelpers';

const baseParams: BaseplateParams = {
  magnetHoles: false,
  magnetDiameter: 6 as BaseplateParams['magnetDiameter'],
  magnetDepth: 2 as BaseplateParams['magnetDepth'],
  paddingLeft: 0 as BaseplateParams['paddingLeft'],
  paddingRight: 0 as BaseplateParams['paddingRight'],
  paddingFront: 0 as BaseplateParams['paddingFront'],
  paddingBack: 0 as BaseplateParams['paddingBack'],
};

describe('v2 layout.setBaseplateParams', () => {
  it('clamps padding values to >= 0', () => {
    const layout = makeLayout();
    const params: BaseplateParams = {
      ...baseParams,
      paddingLeft: -5 as BaseplateParams['paddingLeft'],
    };
    const result = setBaseplateParams.handle({ params }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.params.paddingLeft).toBe(0);
  });

  it('clamps magnetDiameter to [0.5, 20]', () => {
    const layout = makeLayout();
    const params: BaseplateParams = {
      ...baseParams,
      magnetDiameter: 999 as BaseplateParams['magnetDiameter'],
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
    const params: BaseplateParams = { ...baseParams, paddingAnchor: 'tr' };
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
