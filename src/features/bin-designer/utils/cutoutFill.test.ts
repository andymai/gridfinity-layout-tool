import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/features/bin-designer/types';
import {
  MIN_CUTOUT_FILL_MM,
  cutoutFillHeightMm,
  cutoutWallHeightMm,
  maxCutoutTopOffsetMm,
  reanchorCutoutFill,
  topOffsetForFillHeight,
} from './cutoutFill';

/** A socketed bin, so `wallHeight` is `height * heightUnitMm - SOCKET_HEIGHT`. */
function params(overrides: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...overrides };
}

function withFill(
  height: number,
  topOffset: number,
  fillReference: 'rim' | 'floor' | undefined
): BinParams {
  return params({ height, cutoutConfig: { topOffset, fillReference } });
}

describe('cutoutWallHeightMm', () => {
  it('subtracts the socket from the total height', () => {
    // 3u x 7mm = 21mm total, less the 5mm socket.
    expect(cutoutWallHeightMm(params({ height: 3, heightUnitMm: 7 }))).toBeCloseTo(16, 6);
  });

  it('tracks a non-default height unit', () => {
    expect(cutoutWallHeightMm(params({ height: 3, heightUnitMm: 10 }))).toBeCloseTo(25, 6);
  });
});

describe('cutoutFillHeightMm and topOffsetForFillHeight', () => {
  it('round-trips an offset through the fill height', () => {
    expect(topOffsetForFillHeight(16, cutoutFillHeightMm(16, 4))).toBeCloseTo(4, 6);
  });

  it('reports a flush fill as the whole wall height', () => {
    expect(cutoutFillHeightMm(16, 0)).toBeCloseTo(16, 6);
  });

  it('never reports a fill the generator would drop', () => {
    // `buildCutoutCuts` discards every cutout once the surface reaches the
    // floor, so the readout has to stop short rather than reach zero.
    expect(cutoutFillHeightMm(16, 16)).toBe(MIN_CUTOUT_FILL_MM);
    expect(cutoutFillHeightMm(16, 999)).toBe(MIN_CUTOUT_FILL_MM);
  });

  it('clamps a fill taller than the bin back to the wall height', () => {
    expect(topOffsetForFillHeight(16, 40)).toBe(0);
  });

  it('treats a non-finite fill as flush rather than propagating NaN', () => {
    expect(topOffsetForFillHeight(16, Number.NaN)).toBe(0);
  });

  it('leaves room for a fill at the maximum offset', () => {
    expect(maxCutoutTopOffsetMm(16)).toBeCloseTo(16 - MIN_CUTOUT_FILL_MM, 6);
    expect(maxCutoutTopOffsetMm(0)).toBe(0);
  });
});

describe('reanchorCutoutFill', () => {
  it('leaves a rim-anchored design alone when the bin grows', () => {
    // Rim anchoring IS "hold topOffset", which is the pre-existing behaviour
    // and the default every saved design carries.
    const before = withFill(3, 4, 'rim');
    const after = withFill(6, 4, 'rim');
    expect(reanchorCutoutFill(before, after)).toBeUndefined();
  });

  it('treats an absent reference as rim, so old designs do not shift', () => {
    const before = withFill(3, 4, undefined);
    const after = withFill(6, 4, undefined);
    expect(reanchorCutoutFill(before, after)).toBeUndefined();
  });

  it('holds a floor-anchored fill at its height when the bin grows', () => {
    // 3u: wall 16mm, offset 4 → fill 12mm. 6u: wall 37mm, so the fill stays
    // 12mm and the recess absorbs the extra 21mm.
    const before = withFill(3, 4, 'floor');
    const after = withFill(6, 4, 'floor');
    expect(reanchorCutoutFill(before, after)).toBeCloseTo(37 - 12, 6);
  });

  it('holds the fill when the bin shrinks', () => {
    const before = withFill(6, 25, 'floor');
    const after = withFill(3, 25, 'floor');
    // 6u: wall 37, offset 25 → fill 12. 3u: wall 16, so offset becomes 4.
    expect(reanchorCutoutFill(before, after)).toBeCloseTo(4, 6);
  });

  it('reacts to a height-unit change, not just a height change', () => {
    // The reason the helper compares wall heights instead of watching `height`:
    // the same wall height moves for more than one reason.
    const before = withFill(3, 4, 'floor');
    const after = params({
      height: 3,
      heightUnitMm: 10,
      cutoutConfig: { topOffset: 4, fillReference: 'floor' },
    });
    expect(reanchorCutoutFill(before, after)).toBeCloseTo(25 - 12, 6);
  });

  it('reacts to a base-style change, which also moves the wall height', () => {
    const before = withFill(3, 4, 'floor');
    const after = params({
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
      cutoutConfig: { topOffset: 4, fillReference: 'floor' },
    });
    // A flat base has no socket, so the wall is the full 21mm.
    expect(reanchorCutoutFill(before, after)).toBeCloseTo(21 - 12, 6);
  });

  it('does nothing when the wall height is unchanged', () => {
    const before = withFill(3, 4, 'floor');
    const after = params({ ...before, width: 5 });
    expect(reanchorCutoutFill(before, after)).toBeUndefined();
  });

  it('clamps rather than going negative when the bin shrinks below the fill', () => {
    // 6u: wall 37, offset 0 → fill 37. 2u: wall 9, which cannot hold it.
    const before = withFill(6, 0, 'floor');
    const after = withFill(2, 0, 'floor');
    expect(reanchorCutoutFill(before, after)).toBe(0);
  });
});
