import { describe, it, expect } from 'vitest';
import { buildMeasuringStripsSvg } from './measuringStripsSvg';

const LABELS = { title: 'Strips', printHint: 'Print at 100%', placeHint: 'Lay one across & look' };

describe('buildMeasuringStripsSvg', () => {
  const svg = buildMeasuringStripsSvg(LABELS);

  it('prints a 3-, 4- and 5-marker strip of 14 mm squares, 12 in all', () => {
    expect(svg.match(/width="14" height="14"/g)).toHaveLength(12);
    expect(svg).toContain('3 × 84 mm');
    expect(svg).toContain('5 × 168 mm');
  });

  it('keeps every strip on a page both A4 and US Letter can print', () => {
    expect(svg).toContain('width="210mm" height="297mm"');
    for (const [, x, w] of svg.matchAll(
      /<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="26"/g
    )) {
      expect(Number(x)).toBeGreaterThan(5);
      expect(Number(x) + Number(w)).toBeLessThan(205);
    }
  });

  it('escapes the labels it prints', () => {
    expect(svg).toContain('Lay one across &amp; look');
  });
});
