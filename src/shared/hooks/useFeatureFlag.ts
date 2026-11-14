import { useLabsStore } from '@/core/store';
import { resolveFeatureEnabled } from '@/core/store/labs';
import type { FeatureId } from '@/core/labs';

export function useFeatureFlag(featureId: FeatureId): boolean {
  return useLabsStore((state) => resolveFeatureEnabled(state.preferences, featureId));
}

export function isFeatureEnabled(featureId: FeatureId): boolean {
  return useLabsStore.getState().isFeatureEnabled(featureId);
}
