import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import type { StoredBaseplateParams } from '@/core/types';
import { mm } from '@/core/types';
import { setBaseplateParams } from './setBaseplateParams';
import { makeLayout } from './_testHelpers';

// `satisfies` (not `: StoredBaseplateParams`) keeps the literal's narrow
// inferred type — e.g. omitting `connectorStyle` entirely — so this value
// stays assignable both to Layout.baseplateParams (the full stored shape)
// and to setBaseplateParams.handle()'s narrower raw Zod-inferred payload
// (which only permits a subset of connectorStyle's values).
const baseParams = {
  magnetHoles: false,
  magnetDiameter: mm(6),
  magnetDepth: mm(2),
  paddingLeft: mm(0),
  paddingRight: mm(0),
  paddingFront: mm(0),
  paddingBack: mm(0),
} satisfies StoredBaseplateParams;

describe('v2 layout.setBaseplateParams', () => {
  it('clamps padding values to >= 0', () => {
    const layout = makeLayout();
    const params = { ...baseParams, paddingLeft: mm(-5) } satisfies StoredBaseplateParams;
    const result = setBaseplateParams.handle({ params }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.params.paddingLeft).toBe(0);
  });

  it('clamps magnetDiameter to [0.5, 20]', () => {
    const layout = makeLayout();
    const params = { ...baseParams, magnetDiameter: mm(999) } satisfies StoredBaseplateParams;
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
    const params = { ...baseParams, paddingAnchor: 'tr' } satisfies StoredBaseplateParams;
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
