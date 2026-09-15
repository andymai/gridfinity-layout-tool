import { describe, it, expect } from 'vitest';
import { disableFeatureColors } from './plainColors';
import { coloredFeatures, PALETTE } from '@/features/bin-designer/data/examples/palette';

describe('disableFeatureColors', () => {
  it('turns feature colors off and keeps the zone colors for re-enabling', () => {
    const params = { featureColors: coloredFeatures({ scoop: PALETTE.coral }) };

    const result = disableFeatureColors(params).featureColors;

    expect(result?.enabled).toBe(false);
    expect(result?.scoop).toBe(PALETTE.coral);
  });

  it('preserves non-color params', () => {
    const params = { width: 3, depth: 2, featureColors: coloredFeatures() };

    const result = disableFeatureColors(params);

    expect(result.width).toBe(3);
    expect(result.depth).toBe(2);
  });

  it('passes params through untouched when colors are absent or already off', () => {
    const absent = { width: 3 };
    expect(disableFeatureColors(absent)).toBe(absent);

    const off = { featureColors: { ...coloredFeatures(), enabled: false } };
    expect(disableFeatureColors(off)).toBe(off);
  });
});
