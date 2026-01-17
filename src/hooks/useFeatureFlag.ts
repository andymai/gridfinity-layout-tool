import { useLabsStore } from '../store/labs';
import type { FeatureId } from '../Labs/features';

export function useFeatureFlag(featureId: FeatureId): boolean {
  return useLabsStore((state) => state.isFeatureEnabled(featureId));
}

export function isFeatureEnabled(featureId: FeatureId): boolean {
  return useLabsStore.getState().isFeatureEnabled(featureId);
}
