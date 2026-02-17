import { describe, it, expect } from 'vitest';
import { FeatureTag, featureTagName, FEATURE_TAG_COLORS } from './featureTags';

describe('featureTags', () => {
  it('assigns unique numeric values to each tag', () => {
    const values = Object.values(FeatureTag).filter((v): v is number => typeof v === 'number');
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('featureTagName returns human-readable name for known tags', () => {
    expect(featureTagName(FeatureTag.SCOOP)).toBe('Scoop');
    expect(featureTagName(FeatureTag.BASE)).toBe('Base');
  });

  it('featureTagName returns "Unknown" for unrecognized tags', () => {
    expect(featureTagName(254)).toBe('Unknown');
  });

  it('FEATURE_TAG_COLORS has an entry for every tag', () => {
    for (const value of Object.values(FeatureTag)) {
      if (typeof value === 'number') {
        expect(FEATURE_TAG_COLORS[value]).toBeDefined();
      }
    }
  });
});
