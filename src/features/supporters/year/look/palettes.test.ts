import { describe, expect, it } from 'vitest';
import { contrast, hexToOklch, mix, oklchToHex, toyShade } from './color';
import { PALETTES, STAGE_COLOURS, cardColours, tileColours, toy, TOY } from './palettes';

describe('card palettes', () => {
  it.each(Object.entries(PALETTES))('%s sets its text at WCAG AA', (_kind, palette) => {
    expect(contrast(palette.ink, palette.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the month name and the summary values readable on their colours', () => {
    expect(contrast(PALETTES.month.month, PALETTES.month.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(PALETTES.type.vis, PALETTES.type.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(PALETTES.drawers.ink, PALETTES.drawers.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('draws the stage controls white on the dark room', () => {
    expect(contrast(STAGE_COLOURS.ink, STAGE_COLOURS.bg)).toBeGreaterThan(15);
    expect(cardColours('summary')).toEqual({ bg: '#FFE135', ink: '#121A5C' });
  });
});

describe('colour helpers', () => {
  it('mixes in sRGB', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#FF0000', '#0000FF', 0)).toBe('#FF0000');
  });

  it('round-trips a colour through OKLCH', () => {
    for (const hex of ['#9ADCFF', '#D81F2B', '#2EE6A8', '#121A5C']) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    }
  });

  it('lowers chroma to stay inside sRGB', () => {
    const out = oklchToHex({ l: 0.95, c: 0.4, h: 232 });
    expect(out).toMatch(/^#[0-9A-F]{6}$/);
    expect(hexToOklch(out).c).toBeLessThan(0.4);
  });

  it('shades a toy bin lighter above and darker below', () => {
    const shade = toyShade('#FF8AD0');
    expect(shade.face).toBe('#FF8AD0');
    expect(contrast(shade.hi, '#000000')).toBeGreaterThan(contrast(shade.face, '#000000'));
    expect(contrast(shade.lo, '#000000')).toBeLessThan(contrast(shade.face, '#000000'));
  });

  it('cycles the toybox and builds a tile from a card colour', () => {
    expect(toy(TOY.length)).toBe(TOY[0]);
    expect(toy(-1)).toBe(TOY[TOY.length - 1]);
    const tile = tileColours('#2733E0');
    expect(tile.floor).toBe('#2733E0');
    expect(tile.rim).not.toBe(tile.floor);
  });
});
