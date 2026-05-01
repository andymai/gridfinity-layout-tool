import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { mm } from '@/core/types';
import { setPrintBedSize } from './setPrintBedSize';
import { makeLayout } from './_testHelpers';

describe('v2 layout.setPrintBedSize', () => {
  it('clamps size to [42, 500]', () => {
    const layout = makeLayout();
    const result = setPrintBedSize.handle({ size: 9999 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.size).toBe(500);
  });

  it('captures previousSize and previousDepth', () => {
    const layout = makeLayout();
    const result = setPrintBedSize.handle({ size: 200, depth: 220 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.previousSize).toBe(256);
    expect(result.value.event.payload.previousDepth).toBeUndefined();
    expect(result.value.event.payload.depth).toBe(220);
  });

  it('apply() updates printBedSize and printBedDepth', () => {
    const layout = makeLayout();
    const result = setPrintBedSize.handle({ size: 200, depth: 220 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      setPrintBedSize.apply(
        { type: 'layout.printBedSizeSet', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.printBedSize).toBe(mm(200));
    expect(applied.printBedDepth).toBe(mm(220));
  });
});
