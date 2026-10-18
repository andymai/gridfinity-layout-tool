import { describe, it, expect, beforeEach } from 'vitest';
import { isOk } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import { useLayoutStore } from '@/core/store/layout';
import type { Bin } from '@/core/types';
import { designId, gridUnits } from '@/core/types';
import { makeBin, makeLayout } from '@/core/cqrs/v2/domain/bin/_testHelpers';

// At the back row of a 4-deep drawer, the support of a bin leaning back would
// stand past the drawer, unless its overhang keeps it upright.
const leaningBack = (overrides: Partial<Bin> = {}): Bin =>
  makeBin('bin_1', {
    y: gridUnits(3),
    slant: { angleDeg: 40, side: 'back', endSupport: true },
    ...overrides,
  });
const HELD = { overhang: { left: 0, right: 0, front: 0, back: 5 } };

beforeEach(() => {
  useLayoutStore.setState({ layout: makeLayout() });
});

describe('addBin', () => {
  it('checks the bin it stores, overhang included', () => {
    const { id: _id, ...held } = leaningBack(HELD);
    const added = useLayoutStore.getState().addBin(held);
    expect(isOk(added)).toBe(true);

    const { id: _other, ...leaning } = leaningBack({ x: gridUnits(2) });
    const refused = useLayoutStore.getState().addBin(leaning);
    expect(isOk(refused)).toBe(false);
  });
});

describe('duplicateBin', () => {
  it('copies what bin.duplicate copies, so the copy is the bin each slot was checked for', () => {
    const source = leaningBack({
      ...HELD,
      linkedDesignId: designId('d1'),
      extendToMargin: true,
      locked: true,
    });
    useLayoutStore.setState({ layout: makeLayout({ bins: [source] }) });

    const result = useLayoutStore.getState().duplicateBin(source.id);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const copy = useLayoutStore.getState().layout.bins.find((b) => b.id === result.value);
    expect(copy).toMatchObject({
      linkedDesignId: 'd1',
      slant: source.slant,
      extendToMargin: true,
      overhang: HELD.overhang,
    });
    expect(copy?.layerId).not.toBe(STAGING_ID);
    expect(copy?.locked).toBeUndefined();
  });
});
