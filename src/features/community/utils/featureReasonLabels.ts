import type { CommunityFeatureReason } from '@/shared/types/community';

/**
 * Exhaustive by construction: a new reason cannot be added to the union
 * without the compiler demanding its label here.
 */
export const FEATURE_REASON_KEYS: Record<CommunityFeatureReason, string> = {
  'well-made': 'community.featured.reason.wellMade',
  clever: 'community.featured.reason.clever',
  versatile: 'community.featured.reason.versatile',
  'beginner-friendly': 'community.featured.reason.beginnerFriendly',
};
