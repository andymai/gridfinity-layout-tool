import { describe, it, expect } from 'vitest';
import { fitFloorLabel, type FloorLabelFitOptions } from './fitFloorLabel';

/** The bin designer's ladder: 7mm base, 5mm floor, 120mm band on a 1x1. */
function designer(overrides: Partial<FloorLabelFitOptions>): FloorLabelFitOptions {
  return {
    text: 'BITS',
    naturalWidth: 20,
    band: 120,
    baseFontSize: 7,
    minFontSize: 5,
    maxLines: 2,
    ...overrides,
  };
}

describe('fitFloorLabel', () => {
  it('leaves text at the base size when it already fits', () => {
    const fit = fitFloorLabel(designer({ naturalWidth: 100 }));
    expect(fit).toEqual({ fontSize: 7, maxWidth: undefined, text: 'BITS' });
  });

  it('treats an exact fit as fitting', () => {
    const fit = fitFloorLabel(designer({ naturalWidth: 120 }));
    expect(fit.fontSize).toBe(7);
    expect(fit.maxWidth).toBeUndefined();
  });

  it('shrinks onto one line when the overflow is mild', () => {
    // 145mm natural in a 120mm band → 7 * 120/145 ≈ 5.79mm, above the floor.
    const fit = fitFloorLabel(designer({ naturalWidth: 145 }));
    expect(fit.fontSize).toBeCloseTo(5.79, 2);
    expect(fit.maxWidth).toBeUndefined();
    expect(fit.text).toBe('BITS');
  });

  it('shrinks to exactly the band, never past it', () => {
    const fit = fitFloorLabel(designer({ naturalWidth: 145 }));
    expect((145 * fit.fontSize) / 7).toBeCloseTo(120, 6);
  });

  it('stops shrinking at the floor and wraps at full size instead', () => {
    // 7 * 120/180 = 4.67mm, under the 5mm floor → wrap. 180mm fits two 120mm lines.
    const fit = fitFloorLabel(designer({ naturalWidth: 180 }));
    expect(fit.fontSize).toBe(7);
    expect(fit.maxWidth).toBe(120);
    expect(fit.text).toBe('BITS');
  });

  it('shrinks the wrapped block when two lines at full size still overflow', () => {
    // 280mm needs more than 2 x 120mm → 7 * 240/280 = 6mm, still above the floor.
    const fit = fitFloorLabel(designer({ naturalWidth: 280 }));
    expect(fit.fontSize).toBeCloseTo(6, 6);
    expect(fit.maxWidth).toBe(120);
    expect(fit.text).toBe('BITS');
  });

  it('truncates only once a wrapped block at the floor still overflows', () => {
    const text = 'HEX DRIVER BITS SET METRIC AND IMPERIAL';
    // At 5mm the two lines hold 240 * 7/5 = 336mm of base-size text; 672mm is double that.
    const fit = fitFloorLabel(designer({ text, naturalWidth: 672 }));
    expect(fit.fontSize).toBe(5);
    expect(fit.maxWidth).toBe(120);
    expect(fit.text).toMatch(/…$/);
    expect(fit.text.length).toBeLessThan(text.length);
  });

  it('keeps roughly the proportion of the string that fits', () => {
    const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJ'; // 36 chars
    // Capacity is half the natural width → keep about half the characters.
    const fit = fitFloorLabel(designer({ text, naturalWidth: 672 }));
    expect(fit.text.length).toBeGreaterThan(14);
    expect(fit.text.length).toBeLessThan(22);
  });

  it('never truncates to nothing', () => {
    const fit = fitFloorLabel(designer({ text: 'AB', naturalWidth: 1e6 }));
    expect(fit.text.length).toBeGreaterThanOrEqual(2);
  });

  it('trims the space before an ellipsis', () => {
    const fit = fitFloorLabel(
      designer({ text: 'AAAAAAAAAA BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', naturalWidth: 700 })
    );
    expect(fit.text).not.toMatch(/ …$/);
  });

  it('cuts on grapheme clusters so a joined emoji is never split apart', () => {
    const family = '👨‍👩‍👧'; // three code points joined by two zero-width joiners
    const fit = fitFloorLabel(designer({ text: family.repeat(12), naturalWidth: 700 }));

    expect(fit.text).toMatch(/…$/);
    expect(fit.text).not.toMatch(/[\uD800-\uDBFF]…$/); // no orphaned high surrogate
    expect(fit.text).not.toMatch(/‍…$/); // no dangling joiner
    expect(fit.text.replace('…', '').length % family.length).toBe(0);
  });

  it('honours a wider band on a larger bin', () => {
    // Same string, 4x2 bin: 252mm band swallows what a 1x1 had to shrink.
    expect(fitFloorLabel(designer({ naturalWidth: 180, band: 252 })).fontSize).toBe(7);
    expect(fitFloorLabel(designer({ naturalWidth: 180, band: 252 })).maxWidth).toBeUndefined();
  });

  it('is unit agnostic — the planner ladder climbs the same rungs', () => {
    const planner = (naturalWidth: number) =>
      fitFloorLabel({
        text: 'MY DRAWER LAYOUT',
        naturalWidth,
        band: 8.5,
        baseFontSize: 0.5,
        minFontSize: 0.36,
        maxLines: 2,
      });

    expect(planner(8)).toMatchObject({ fontSize: 0.5, maxWidth: undefined });
    // 0.5 * 8.5/10 = 0.425, still above the 0.36 floor.
    expect(planner(10).fontSize).toBeCloseTo(0.425, 6);
    expect(planner(10).maxWidth).toBeUndefined();
    // 0.5 * 8.5/12 = 0.354 would dip under the floor, so it wraps instead.
    expect(planner(12)).toMatchObject({ fontSize: 0.5, maxWidth: 8.5 });
  });

  it.each([
    ['empty text', { text: '', naturalWidth: 200 }],
    ['an unmeasured width', { naturalWidth: 0 }],
    ['a NaN measurement', { naturalWidth: Number.NaN }],
    ['a zero band', { band: 0 }],
  ])('falls back to the base size given %s', (_label, overrides) => {
    const fit = fitFloorLabel(designer(overrides));
    expect(fit.fontSize).toBe(7);
    expect(fit.maxWidth).toBeUndefined();
  });
});
