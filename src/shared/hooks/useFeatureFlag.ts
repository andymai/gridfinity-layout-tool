import { useLabsStore } from '@/core/store';
import type { FeatureId } from '@/core/labs';

export function useFeatureFlag(featureId: FeatureId): boolean {
  return useLabsStore((state) => state.isFeatureEnabled(featureId));
}

export function isFeatureEnabled(featureId: FeatureId): boolean {
  return useLabsStore.getState().isFeatureEnabled(featureId);
}
