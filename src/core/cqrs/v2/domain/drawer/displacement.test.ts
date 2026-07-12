import { describe, expect, it } from 'vitest';
import { gridUnits } from '@/core/types';
import type { DrawerOutline } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { computeDisplacedBins } from './displacement';
import { makeBin } from './_testHelpers';

const U = 42;

const L_OUTLINE: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 6 * U, y: 0 },
    { x: 6 * U, y: 2 * U },
    { x: 4 * U, y: 2 * U },
    { x: 4 * U, y: 4 * U },
    { x: 0, y: 4 * U },
  ],
};

const drawer = { width: gridUnits(6), depth: gridUnits(4) };

describe('computeDisplacedBins', () => {
  it('displaces out-of-bounds bins without an outline', () => {
    const bins = [makeBin('bin_out', 5, 3), makeBin('bin_in', 0, 0)];
    expect(computeDisplacedBins(bins, { ...drawer, width: gridUnits(4) }, U)).toEqual(['bin_out']);
  });

  it('displaces bins outside the outline even when in bounds', () => {
    const bins = [makeBin('bin_notch', 5, 3), makeBin('bin_body', 0, 0)];
    expect(computeDisplacedBins(bins, { ...drawer, outline: L_OUTLINE }, U)).toEqual(['bin_notch']);
  });

  it('keeps boundary-flush bins', () => {
    // Footprint ending exactly on the notch wall (x: 3..4) is inside.
    const bins = [makeBin('bin_flush', 3, 3)];
    expect(computeDisplacedBins(bins, { ...drawer, outline: L_OUTLINE }, U)).toEqual([]);
  });

  it('displaces bins with negative coordinates', () => {
    const bins = [makeBin('bin_neg', -1, 0)];
    expect(computeDisplacedBins(bins, drawer, U)).toEqual(['bin_neg']);
  });

  it('never displaces staged bins', () => {
    const bins = [makeBin('bin_staged', 5, 3, STAGING_ID)];
    expect(computeDisplacedBins(bins, { ...drawer, outline: L_OUTLINE }, U)).toEqual([]);
  });
});
