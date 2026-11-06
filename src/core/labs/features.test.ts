import { describe, it, expect } from 'vitest';
import type { FeatureFlag } from './types';
import { FEATURE_FLAGS as FEATURE_FLAGS_LITERAL, getFeature } from './features';

// `FEATURE_FLAGS` is inferred as today's exact literals, so a check for a field
// no current entry sets reads as an impossible comparison. Widening once here
// keeps these assertions valid as the set of flags changes.
const FEATURE_FLAGS: readonly FeatureFlag[] = FEATURE_FLAGS_LITERAL;

describe('FEATURE_FLAGS', () => {
  it('gives every flag a unique id', () => {
    const ids = FEATURE_FLAGS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every flag a name and description for the Labs card', () => {
    FEATURE_FLAGS.forEach((feature) => {
      expect(feature.name).toBeTruthy();
      expect(feature.description).toBeTruthy();
    });
  });

  it('warns on every medium or high risk flag', () => {
    FEATURE_FLAGS.filter((f) => f.risk !== 'low').forEach((feature) => {
      expect(feature.warning).toBeTruthy();
    });
  });
});

describe('getFeature', () => {
  it('returns a registered flag by id', () => {
    expect(getFeature('brepkit_kernel')?.id).toBe('brepkit_kernel');
  });

  it('returns undefined for an id the registry does not have', () => {
    expect(getFeature('non_existent_feature')).toBeUndefined();
  });
});
