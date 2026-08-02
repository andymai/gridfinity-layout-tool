import { describe, expect, it } from 'vitest';
import { gridUnits, mm } from '@/core/types';
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
    expect(computeDisplacedBins(bins, { ...drawer, width: gridUnits(4) }, undefined, U)).toEqual([
      'bin_out',
    ]);
  });

  it('displaces bins outside the outline even when in bounds', () => {
    const bins = [makeBin('bin_notch', 5, 3), makeBin('bin_body', 0, 0)];
    expect(computeDisplacedBins(bins, { ...drawer, outline: L_OUTLINE }, undefined, U)).toEqual([
      'bin_notch',
    ]);
  });

  it('keeps boundary-flush bins', () => {
    // Footprint ending exactly on the notch wall (x: 3..4) is inside.
    const bins = [makeBin('bin_flush', 3, 3)];
    expect(computeDisplacedBins(bins, { ...drawer, outline: L_OUTLINE }, undefined, U)).toEqual([]);
  });

  it('displaces bins with negative coordinates', () => {
    const bins = [makeBin('bin_neg', -1, 0)];
    expect(computeDisplacedBins(bins, drawer, undefined, U)).toEqual(['bin_neg']);
  });

  it('never displaces staged bins', () => {
    const bins = [makeBin('bin_staged', 5, 3, STAGING_ID)];
    expect(computeDisplacedBins(bins, { ...drawer, outline: L_OUTLINE }, undefined, U)).toEqual([]);
  });

  it('displaces bins the manual grid shift pushes outside the frame (#3157)', () => {
    // A +10mm grid shift renders the outline 10mm to the left, so a bin flush
    // against the body's right edge falls off the shared frame.
    const bins = [makeBin('bin_flush_right', 5, 1), makeBin('bin_body', 0, 0)];
    expect(
      computeDisplacedBins(
        bins,
        { ...drawer, outline: L_OUTLINE, gridShiftX: mm(10) },
        undefined,
        U
      )
    ).toEqual(['bin_flush_right']);
  });

  it('measures footprints with the per-axis pitch on a non-square grid (#2733)', () => {
    const UX = 48;
    const UY = 42;
    const lNs: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 6 * UX, y: 0 },
        { x: 6 * UX, y: 2 * UY },
        { x: 4 * UX, y: 2 * UY },
        { x: 4 * UX, y: 4 * UY },
        { x: 0, y: 4 * UY },
      ],
    };
    // bin_back sits flush against the drawer's back edge (4 × UY) — using the
    // X pitch on Y would wrongly displace it.
    const bins = [makeBin('bin_back', 0, 3), makeBin('bin_notch', 5, 3)];
    expect(computeDisplacedBins(bins, { ...drawer, outline: lNs }, undefined, UX, UY)).toEqual([
      'bin_notch',
    ]);
  });
});
