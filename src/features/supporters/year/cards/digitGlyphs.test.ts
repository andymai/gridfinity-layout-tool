import { describe, expect, it } from 'vitest';
import { placeDigits } from './binsScene';
import { GLYPH_ROWS, buildDigits } from './digitGlyphs';
import { CONTENT_W, MARGIN } from './scene';

describe('buildDigits', () => {
  it('builds 148 from 147 bins, the 148th crooked in the bowl of the 8', () => {
    const layout = buildDigits('148');
    expect(layout.cells).toHaveLength(147);
    expect(layout.cols).toBe(18);
    expect(layout.stray).toEqual({ r: 11, c: 14.5, glyph: 2 });
  });

  it.each(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])(
    'has a glyph for %s with a resting place for the stray bin',
    (digit) => {
      const layout = buildDigits(digit);
      expect(layout.cells.length).toBeGreaterThan(10);
      expect(layout.stray).not.toBeNull();
      const { r = 0, c = 0 } = layout.stray ?? {};
      expect(r).toBeLessThan(GLYPH_ROWS);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(layout.cols);
      // The stray rests in an empty socket, not on a bin of the glyph.
      expect(layout.cells.some((cell) => cell.r === r && cell.c === Math.floor(c))).toBe(false);
    }
  );

  it('sets group separators as the locale writes them', () => {
    expect(buildDigits('1,234').cols).toBe(buildDigits('1.234').cols);
    expect(buildDigits('12 000').cols).toBeGreaterThan(buildDigits('12000').cols);
    expect(buildDigits(`12${String.fromCharCode(0x202f)}000`).cols).toBe(
      buildDigits('12 000').cols
    );
  });

  it('skips characters it has no glyph for', () => {
    expect(buildDigits('4x').cells).toEqual(buildDigits('4').cells);
  });
});

describe('placeDigits', () => {
  it.each(['1', '3', '48', '148', '1,234', '12,000', '1,234,567'])(
    'fits %s inside the card width with a capped number of bins',
    (text) => {
      const place = placeDigits(text);
      expect(place.left).toBeGreaterThanOrEqual(MARGIN - 0.01);
      expect(place.left + place.cols * place.cell).toBeLessThanOrEqual(MARGIN + CONTENT_W + 0.01);
      expect(place.cell).toBeLessThanOrEqual(53);
      expect(place.cells.length).toBeLessThan(500);
    }
  );

  it('keeps short counts at the full cell and stands every count on one floor', () => {
    expect(placeDigits('3').cell).toBe(53);
    const short = placeDigits('3');
    const long = placeDigits('12,000');
    expect(short.top + GLYPH_ROWS * short.cell).toBeCloseTo(long.top + GLYPH_ROWS * long.cell);
  });

  it('rises and shrinks when the text under it needs room', () => {
    const low = placeDigits('148', 1000);
    expect(low.top + GLYPH_ROWS * low.cell).toBeCloseTo(1000);
    expect(low.top).toBeGreaterThanOrEqual(300);
  });
});
