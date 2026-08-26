import { describe, it, expect } from 'vitest';
import { aabbsIntersect, estimateLabelAabb, fitLabelFontSize } from './cutoutLabelFit';
import type { TextStyleDefaults } from '@/features/bin-designer/types';
import { DEFAULT_TEXT_STYLE_DEFAULTS } from '@/features/bin-designer/types';
import type { CutoutLabelPlacement } from '@/shared/utils/cutoutLabel';

describe('fitLabelFontSize', () => {
  const defaults: TextStyleDefaults = {
    ...DEFAULT_TEXT_STYLE_DEFAULTS,
    font: 'atkinson',
    mode: 'engrave',
    depth: 0.4,
    margin: 1.5,
    minFontSize: 3,
    maxFontSize: 20,
  };
  // A roomy band so auto-fit lands at the 20mm ceiling for a short label.
  const roomy: CutoutLabelPlacement = { centerX: 0, centerY: 0, availW: 200, availD: 200 };

  it('caps the size at the override when it fits below auto-fit', () => {
    const auto = fitLabelFontSize('A', roomy, defaults, {});
    const capped = fitLabelFontSize('A', roomy, defaults, { textStyle: { fontSizeOverride: 6 } });
    expect(auto).not.toBeNull();
    expect(capped).toBe(6);
    expect(capped!).toBeLessThan(auto!);
  });

  it('clamps the override to the band, never grows past what fits', () => {
    // availD 8 − 2·margin(1.5) = 5mm depth budget caps auto-fit at 5mm; a 12mm
    // override must collapse to that, mirroring the worker's band clamp.
    const narrow: CutoutLabelPlacement = { centerX: 0, centerY: 0, availW: 200, availD: 8 };
    const auto = fitLabelFontSize('A', narrow, defaults, {});
    const over = fitLabelFontSize('A', narrow, defaults, { textStyle: { fontSizeOverride: 12 } });
    expect(auto).toBeCloseTo(5, 6);
    expect(over).toBeCloseTo(auto!, 6);
  });

  it('floors a sub-minFontSize override at the legibility floor', () => {
    // The UI can't produce this (slider min = minFontSize), but a crafted share
    // can. The band fits well above 3mm, so a 1mm override clamps up to 3mm
    // rather than rendering illegibly small.
    expect(fitLabelFontSize('A', roomy, defaults, { textStyle: { fontSizeOverride: 1 } })).toBe(3);
  });

  it('returns null when even the floor overflows, override notwithstanding', () => {
    const tiny: CutoutLabelPlacement = { centerX: 0, centerY: 0, availW: 200, availD: 4 };
    // availD 4 − 3 = 1mm < 3mm floor → dropped, same as auto-fit.
    expect(
      fitLabelFontSize('A', tiny, defaults, { textStyle: { fontSizeOverride: 3 } })
    ).toBeNull();
  });

  it('honours an explicit fixed size past the auto-fit ceiling', () => {
    // 25mm exceeds maxFontSize (20) — a target is not capped by the auto
    // ceiling, matching the worker's fixed path.
    const size = fitLabelFontSize('A', roomy, defaults, {
      textStyle: { sizeMode: 'fixed', fixedSize: 25 },
    });
    expect(size).toBe(25);
  });

  it('shrinks an explicit size only to what the band holds', () => {
    const narrow: CutoutLabelPlacement = { centerX: 0, centerY: 0, availW: 200, availD: 8 };
    const size = fitLabelFontSize('A', narrow, defaults, {
      textStyle: { sizeMode: 'fixed', fixedSize: 12 },
    });
    expect(size).toBeCloseTo(5, 6);
  });

  it('drops an explicit label the band cannot hold legibly', () => {
    const tiny: CutoutLabelPlacement = { centerX: 0, centerY: 0, availW: 200, availD: 4 };
    expect(
      fitLabelFontSize('A', tiny, defaults, { textStyle: { sizeMode: 'fixed', fixedSize: 12 } })
    ).toBeNull();
  });

  it('honours a sub-floor explicit size that fits, unlike an override', () => {
    // The fixed path has no legibility floor on the asked-for size itself —
    // only the shrink is floored. Mirrors the worker exactly.
    expect(
      fitLabelFontSize('A', roomy, defaults, { textStyle: { sizeMode: 'fixed', fixedSize: 2 } })
    ).toBe(2);
  });

  it('renders a style-less text element at the design fixed size, not auto', () => {
    const size = fitLabelFontSize('A', roomy, defaults, { shape: 'text' });
    expect(size).toBe(defaults.fixedSize);
  });

  it('ignores a leftover fontSizeOverride once a fixed size is set', () => {
    const size = fitLabelFontSize('A', roomy, defaults, {
      textStyle: { sizeMode: 'fixed', fixedSize: 10, fontSizeOverride: 4 },
    });
    expect(size).toBe(10);
  });
});

describe('estimateLabelAabb', () => {
  it('sizes the box from the glyph-width estimate, centered on the anchor', () => {
    const box = estimateLabelAabb('ABCD', 10, 50, 20, 0);
    // 4 chars × 0.6 ratio × 10mm = 24mm wide, 10mm tall.
    expect(box.maxX - box.minX).toBeCloseTo(24, 6);
    expect(box.maxY - box.minY).toBeCloseTo(10, 6);
    expect((box.minX + box.maxX) / 2).toBeCloseTo(50, 6);
    expect((box.minY + box.maxY) / 2).toBeCloseTo(20, 6);
  });

  it('is rotation-aware: a 90° label swaps its extents', () => {
    const box = estimateLabelAabb('ABCD', 10, 0, 0, 90);
    expect(box.maxX - box.minX).toBeCloseTo(10, 6);
    expect(box.maxY - box.minY).toBeCloseTo(24, 6);
  });
});

describe('aabbsIntersect', () => {
  const a = { minX: 0, maxX: 10, minY: 0, maxY: 10 };

  it('detects overlap and rejects touching edges', () => {
    expect(aabbsIntersect(a, { minX: 5, maxX: 15, minY: 5, maxY: 15 })).toBe(true);
    expect(aabbsIntersect(a, { minX: 10, maxX: 20, minY: 0, maxY: 10 })).toBe(false);
    expect(aabbsIntersect(a, { minX: 11, maxX: 20, minY: 0, maxY: 10 })).toBe(false);
  });
});
