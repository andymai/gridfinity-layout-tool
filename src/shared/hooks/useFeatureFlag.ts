import { useLabsStore } from '@/core/store';
import { resolveFeatureEnabled } from '@/core/store/labs';
import type { FeatureId } from '@/core/labs';

/**
 * Selects through the same resolver the store's `isFeatureEnabled` uses.
 *
 * This hook is what every gated surface in the UI reads, so a second copy of
 * the rules here means the app can disagree with itself about one flag — and
 * did: a hand-rolled `enabledFeatures[id] ?? false` ignored `defaultEnabled`,
 * so a flag that was on everywhere else was off in every component.
 *
 * The selector reads `state.preferences` so zustand still tracks the
 * dependency and re-renders on a toggle.
 */
export function useFeatureFlag(featureId: FeatureId): boolean {
  return useLabsStore((state) => resolveFeatureEnabled(state.preferences, featureId));
}

export function isFeatureEnabled(featureId: FeatureId): boolean {
  return useLabsStore.getState().isFeatureEnabled(featureId);
}
