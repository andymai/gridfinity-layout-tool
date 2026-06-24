import { describe, it, expect } from 'vitest';
import { getContrastingTextColor } from './usePreviewColor';

const DARK = 'hsl(0, 0%, 13%)';
const LIGHT = 'hsl(0, 0%, 98%)';

describe('getContrastingTextColor', () => {
  it('uses dark text on light fills (no white-on-white)', () => {
    expect(getContrastingTextColor('#ffffff')).toBe(DARK);
    expect(getContrastingTextColor('#d4d8dc')).toBe(DARK); // default preview color
  });

  it('uses light text on dark fills (no black-on-black)', () => {
    expect(getContrastingTextColor('#000000')).toBe(LIGHT);
    expect(getContrastingTextColor('#222222')).toBe(LIGHT);
    expect(getContrastingTextColor('#1e3a8a')).toBe(LIGHT); // dark blue
  });

  it('is hue-aware: bright yellow is perceptually light so it gets dark text', () => {
    // A naive value/lightness check would mis-call yellow as dark; relative
    // luminance weights green/red heavily, so yellow reads bright.
    expect(getContrastingTextColor('#f5e000')).toBe(DARK);
  });
});
