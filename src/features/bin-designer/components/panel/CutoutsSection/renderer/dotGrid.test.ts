import { describe, it, expect } from 'vitest';
import { Color, SRGBColorSpace } from 'three';
import { luminanceContrast, relativeLuminance } from '@/shared/utils/color';
import { displayedSurfaceSrgb, getDotGridStyle, getDotInterval } from './dotGrid';

function blendedContrast(surface: string, ink: string, opacity: number): number {
  const s = displayedSurfaceSrgb(surface);
  const i = new Color(ink).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  const mix = (a: number, b: number): number => a * (1 - opacity) + b * opacity;
  return luminanceContrast(
    relativeLuminance(s.r, s.g, s.b),
    relativeLuminance(mix(s.r, i.r), mix(s.g, i.g), mix(s.b, i.b))
  );
}

describe('getDotInterval', () => {
  it('keeps 1mm dots when zoomed in on a small bin', () => {
    expect(getDotInterval(84, 42, 23)).toBe(1);
    expect(getDotInterval(84, 42, 50)).toBe(1);
  });

  it('never packs dots closer than a few screen pixels when zoomed out', () => {
    for (const zoom of [0.1, 0.3, 0.5, 1, 2, 3, 4, 6, 10, 25, 50]) {
      expect(getDotInterval(84, 42, zoom) * zoom).toBeGreaterThanOrEqual(8);
    }
  });

  it('only ever gets coarser as the view zooms out', () => {
    let previous = 0;
    for (const zoom of [50, 25, 12, 8, 6, 4, 3, 2, 1, 0.5]) {
      const interval = getDotInterval(126, 84, zoom);
      expect(interval).toBeGreaterThanOrEqual(previous);
      previous = interval;
    }
  });

  it('coarsens a very large bin rather than instancing every millimetre', () => {
    const interval = getDotInterval(420, 420, 50);
    const dots = (Math.floor(420 / interval) + 1) ** 2;
    expect(interval).toBeGreaterThan(1);
    expect(dots).toBeLessThanOrEqual(50_000);
  });
});

describe('displayedSurfaceSrgb', () => {
  it('matches the pixels the editor canvas renders for a bin fill', () => {
    const toBytes = (c: { r: number; g: number; b: number }): number[] =>
      [c.r, c.g, c.b].map((v) => Math.round(v * 255));
    expect(toBytes(displayedSurfaceSrgb('#d4d8dc'))).toEqual([211, 212, 214]);
    expect(toBytes(displayedSurfaceSrgb('#3a3f47'))).toEqual([44, 49, 59]);
  });
});

describe('getDotGridStyle', () => {
  const surfaces = ['#d4d8dc', '#ffffff', '#000000', '#333333', '#ffff00', '#0000ff', '#808080'];

  it('reads clearly against the default bin surface', () => {
    const style = getDotGridStyle('#d4d8dc', false);
    expect(style.color).toBe('#000000');
    expect(blendedContrast('#d4d8dc', style.color, style.opacity)).toBeGreaterThanOrEqual(2);
  });

  it('picks the ink by luminance, so a bright yellow bin gets dark dots', () => {
    expect(getDotGridStyle('#ffff00', false).color).toBe('#000000');
    expect(getDotGridStyle('#0000ff', false).color).toBe('#ffffff');
  });

  it.each(surfaces)('meets the 3:1 non-text contrast floor on %s in high contrast', (surface) => {
    const style = getDotGridStyle(surface, true);
    expect(blendedContrast(surface, style.color, style.opacity)).toBeGreaterThanOrEqual(3);
  });

  it('makes high-contrast dots larger and stronger than the default', () => {
    for (const surface of surfaces) {
      const normal = getDotGridStyle(surface, false);
      const high = getDotGridStyle(surface, true);
      expect(high.radiusPx).toBeGreaterThan(normal.radiusPx);
      expect(high.opacity).toBeGreaterThan(normal.opacity);
    }
  });
});
