import { describe, expect, it } from 'vitest';
import { fitPaddingToDrawer, plateDrawerOverflow } from './fitPaddingToDrawer';

const MEASURED = { width: 541, depth: 496 };
const STALE = {
  paddingLeft: 10.5,
  paddingRight: 10.5,
  paddingFront: 0,
  paddingBack: 21,
  paddingAnchor: 'bc' as const,
};

describe('plateDrawerOverflow', () => {
  it('reports how far the plate runs past the drawer', () => {
    expect(plateDrawerOverflow(546, 504, MEASURED)).toEqual({ widthMm: 5, depthMm: 8 });
  });

  it('reports a fitting axis as zero when only the other overflows', () => {
    expect(plateDrawerOverflow(530, 504, MEASURED)).toEqual({ widthMm: 0, depthMm: 8 });
  });

  it('is null when the plate fits, including within rounding', () => {
    expect(plateDrawerOverflow(541, 496, MEASURED)).toBeNull();
    expect(plateDrawerOverflow(541.04, 480, MEASURED)).toBeNull();
  });
});

describe('fitPaddingToDrawer', () => {
  it('fills the drawer along the chosen anchor', () => {
    expect(fitPaddingToDrawer(STALE, 525, 483, MEASURED)).toMatchObject({
      paddingLeft: 8,
      paddingRight: 8,
      paddingFront: 0,
      paddingBack: 13,
    });
  });

  it('keeps the current proportions without an anchor', () => {
    const custom = { paddingLeft: 15, paddingRight: 5, paddingFront: 2, paddingBack: 0 };
    expect(fitPaddingToDrawer(custom, 525, 483, MEASURED)).toMatchObject({
      paddingLeft: 12,
      paddingRight: 4,
      paddingFront: 2,
      paddingBack: 0,
    });
  });

  // Slack left on a fitting axis may be deliberate, and refilling it could also
  // run past the per-side padding cap on a wide drawer.
  it('leaves an axis that already fits untouched', () => {
    const fitted = fitPaddingToDrawer(STALE, 525, 483, { width: 541, depth: 900 });
    expect(fitted).toMatchObject({ paddingLeft: 8, paddingRight: 8 });
    expect(fitted).toMatchObject({ paddingFront: 0, paddingBack: 21 });
  });

  it('never lands the plate over the drawer on a fractional slack', () => {
    const fitted = fitPaddingToDrawer(STALE, 525, 483, { width: 541.257, depth: 496 });
    expect(525 + fitted.paddingLeft + fitted.paddingRight).toBeLessThanOrEqual(541.257);
  });

  it('drops padding to zero when the grid alone exceeds the drawer', () => {
    expect(fitPaddingToDrawer(STALE, 546, 504, MEASURED)).toMatchObject({
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
    });
  });
});
