import { describe, expect, it } from 'vitest';
import { desaturateColor } from './materialProps';

describe('desaturateColor', () => {
  it('returns the original hex when amount=0', () => {
    expect(desaturateColor('#ff8800', 0)).toBe('#ff8800');
  });

  it('collapses to the channel-wise luminance when amount=1', () => {
    // luminance(255, 136, 0) = 0.2126*255 + 0.7152*136 + 0.0722*0 ≈ 151.49 → 0x97
    const result = desaturateColor('#ff8800', 1);
    expect(result).toBe('#979797');
  });

  it('shifts mid-amount tints toward gray while preserving brightness', () => {
    // Bright filament should desaturate toward a light-ish gray
    const fromBright = desaturateColor('#ff8800', 0.5);
    const r = parseInt(fromBright.slice(1, 3), 16);
    const g = parseInt(fromBright.slice(3, 5), 16);
    const b = parseInt(fromBright.slice(5, 7), 16);
    expect(r).toBeLessThan(255);
    expect(g).toBeGreaterThan(136);
    expect(b).toBeGreaterThan(0);
    // All three channels should converge — gap reduced from original (255 - 0 = 255)
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(255);
  });

  it('keeps already-gray colors near gray', () => {
    expect(desaturateColor('#808080', 0.5)).toBe('#808080');
  });

  it('returns the input unchanged for malformed hex', () => {
    expect(desaturateColor('not-a-hex')).toBe('not-a-hex');
    expect(desaturateColor('#xyz')).toBe('#xyz');
  });

  it('handles hex without leading hash', () => {
    expect(desaturateColor('ff8800', 1)).toBe('#979797');
  });
});
