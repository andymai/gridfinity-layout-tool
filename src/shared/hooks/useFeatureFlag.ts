import { useLabsStore } from '@/core/store';
import { getFeature } from '@/core/labs';
import type { FeatureId } from '@/core/labs';

export function useFeatureFlag(featureId: FeatureId): boolean {
  return useLabsStore((state) => {
    const feature = getFeature(featureId);

    // Graduated features are always enabled
    if (feature?.status === 'graduated') return true;

    // Deprecated features are always disabled
    if (feature?.status === 'deprecated') return false;

    // Coming Soon features are always disabled
    if (feature?.comingSoon) return false;

    // Read directly from state.preferences so Zustand tracks the dependency
    return state.preferences.enabledFeatures[featureId] ?? false;
  });
}

export function isFeatureEnabled(featureId: FeatureId): boolean {
  return useLabsStore.getState().isFeatureEnabled(featureId);
}
