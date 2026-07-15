import { describe, it, expect } from 'vitest';
import { fitLabelFontSize } from './cutoutLabelFit';
import type { TextStyleDefaults } from '@/features/bin-designer/types';
import type { CutoutLabelPlacement } from '@/shared/utils/cutoutLabel';

describe('fitLabelFontSize', () => {
  const defaults: TextStyleDefaults = {
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
    const auto = fitLabelFontSize('A', roomy, defaults, undefined);
    const capped = fitLabelFontSize('A', roomy, defaults, 6);
    expect(auto).not.toBeNull();
    expect(capped).toBe(6);
    expect(capped!).toBeLessThan(auto!);
  });

  it('clamps the override to the band, never grows past what fits', () => {
    // availD 8 − 2·margin(1.5) = 5mm depth budget caps auto-fit at 5mm; a 12mm
    // override must collapse to that, mirroring the worker's band clamp.
    const narrow: CutoutLabelPlacement = { centerX: 0, centerY: 0, availW: 200, availD: 8 };
    const auto = fitLabelFontSize('A', narrow, defaults, undefined);
    const over = fitLabelFontSize('A', narrow, defaults, 12);
    expect(auto).toBeCloseTo(5, 6);
    expect(over).toBeCloseTo(auto!, 6);
  });

  it('returns null when even the floor overflows, override notwithstanding', () => {
    const tiny: CutoutLabelPlacement = { centerX: 0, centerY: 0, availW: 200, availD: 4 };
    // availD 4 − 3 = 1mm < 3mm floor → dropped, same as auto-fit.
    expect(fitLabelFontSize('A', tiny, defaults, 3)).toBeNull();
  });
});
