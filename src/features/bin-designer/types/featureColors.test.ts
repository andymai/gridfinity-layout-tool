import { describe, it, expect } from 'vitest';
import { FeatureTag } from '@/shared/types/generation';
import { featureTagToColorZone } from './featureColors';

describe('featureTagToColorZone', () => {
  it('maps LIP to lip zone', () => {
    expect(featureTagToColorZone(FeatureTag.LIP)).toBe('lip');
  });

  it('maps LABEL_TAB to labelTab zone', () => {
    expect(featureTagToColorZone(FeatureTag.LABEL_TAB)).toBe('labelTab');
  });

  it.each([
    ['BASE', FeatureTag.BASE],
    ['SCOOP', FeatureTag.SCOOP],
    ['SOCKET', FeatureTag.SOCKET],
    ['WALL_CUTOUT', FeatureTag.WALL_CUTOUT],
    ['DIVIDER', FeatureTag.DIVIDER],
    ['SLOT', FeatureTag.SLOT],
    ['INSERT', FeatureTag.INSERT],
    ['CUTOUT', FeatureTag.CUTOUT],
    ['WALL_PATTERN', FeatureTag.WALL_PATTERN],
    ['HANDLE', FeatureTag.HANDLE],
    ['UNKNOWN', FeatureTag.UNKNOWN],
  ] as const)('maps %s to body zone', (_name, tag) => {
    expect(featureTagToColorZone(tag)).toBe('body');
  });
});
