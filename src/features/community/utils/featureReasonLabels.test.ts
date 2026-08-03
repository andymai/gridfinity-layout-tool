import { describe, expect, it } from 'vitest';
import { COMMUNITY_FEATURE_REASONS } from '@/shared/types/community';
import { FEATURE_REASON_KEYS } from './featureReasonLabels';

describe('FEATURE_REASON_KEYS', () => {
  it('covers every reason in the union', () => {
    for (const reason of COMMUNITY_FEATURE_REASONS) {
      expect(FEATURE_REASON_KEYS[reason]).toBeTruthy();
    }
  });

  it('has no labels for reasons that do not exist', () => {
    expect(Object.keys(FEATURE_REASON_KEYS).sort()).toEqual([...COMMUNITY_FEATURE_REASONS].sort());
  });
});
