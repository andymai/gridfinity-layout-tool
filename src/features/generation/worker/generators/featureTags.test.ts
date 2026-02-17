import { describe, it, expect } from 'vitest';
import { FeatureTag } from './featureTags';

describe('featureTags', () => {
  it('assigns unique numeric values to each tag', () => {
    const values = Object.values(FeatureTag).filter((v): v is number => typeof v === 'number');
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
