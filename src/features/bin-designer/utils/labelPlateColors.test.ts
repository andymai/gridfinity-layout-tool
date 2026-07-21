import { describe, it, expect } from 'vitest';
import { FeatureTag } from '@/shared/types/generation';
import type { FaceGroupData } from '@/shared/types/generation';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '../constants/defaults';
import type { FeatureColorConfig } from '../types';
import { buildLabelPlateColorConfig } from './labelPlateColors';

const COLORED: FeatureColorConfig = {
  ...DEFAULT_FEATURE_COLOR_CONFIG,
  enabled: true,
  labelTab: '#222222',
  text: '#ffffff',
};

// Two groups of 2 triangles each: body faces then TEXT faces.
const GROUPS: readonly FaceGroupData[] = [
  { start: 0, count: 6, tag: FeatureTag.UNKNOWN },
  { start: 6, count: 6, tag: FeatureTag.TEXT },
];

describe('buildLabelPlateColorConfig', () => {
  it('maps TEXT-tagged triangles to the text material', () => {
    const config = buildLabelPlateColorConfig(GROUPS, 4, COLORED);
    expect(config).toBeDefined();
    expect(config?.materials).toEqual([{ color: '#222222' }, { color: '#ffffff' }]);
    expect(config?.triangleMaterialIndices).toEqual([0, 0, 1, 1]);
  });

  it('returns undefined when multi-color is disabled', () => {
    const disabled = { ...COLORED, enabled: false };
    expect(buildLabelPlateColorConfig(GROUPS, 4, disabled)).toBeUndefined();
    expect(buildLabelPlateColorConfig(GROUPS, 4, undefined)).toBeUndefined();
  });

  it('returns undefined when plate and text colors match', () => {
    const uniform = { ...COLORED, text: '#222222' };
    expect(buildLabelPlateColorConfig(GROUPS, 4, uniform)).toBeUndefined();
  });

  it('returns undefined without face groups or without any TEXT faces', () => {
    expect(buildLabelPlateColorConfig(undefined, 4, COLORED)).toBeUndefined();
    expect(buildLabelPlateColorConfig([], 4, COLORED)).toBeUndefined();
    const noText: readonly FaceGroupData[] = [{ start: 0, count: 12, tag: FeatureTag.UNKNOWN }];
    expect(buildLabelPlateColorConfig(noText, 4, COLORED)).toBeUndefined();
  });

  it('clamps TEXT ranges that overrun the triangle count', () => {
    const overrun: readonly FaceGroupData[] = [{ start: 6, count: 30, tag: FeatureTag.TEXT }];
    const config = buildLabelPlateColorConfig(overrun, 4, COLORED);
    expect(config?.triangleMaterialIndices).toEqual([0, 0, 1, 1]);
  });
});
