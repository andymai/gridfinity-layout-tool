import { useLabsStore } from '@/features/labs/store/labs';
import type { FeatureId } from '@/features/labs/definitions/features';

export function useFeatureFlag(featureId: FeatureId): boolean {
  return useLabsStore((state) => state.isFeatureEnabled(featureId));
}

export function isFeatureEnabled(featureId: FeatureId): boolean {
  return useLabsStore.getState().isFeatureEnabled(featureId);
}
