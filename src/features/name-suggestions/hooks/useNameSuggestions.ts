/**
 * Main hook for consuming name suggestions in UI components.
 *
 * Provides:
 * - Current suggestion state
 * - Actions for accepting/dismissing
 * - Telemetry tracking
 */

import { useCallback, useMemo } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useShallow } from 'zustand/react/shallow';
import { trackEvent } from '@/utils/analytics';
import { useNameSuggestionStore } from '../store';
import { hashName, editDistance } from '../utils';
import type { NameSuggestion, SuggestionTelemetryEvent } from '../types';

export interface UseNameSuggestionsReturn {
  /** Primary suggestion (if available and should show) */
  primarySuggestion: NameSuggestion | null;
  /** Alternative suggestions */
  alternatives: NameSuggestion[];
  /** Whether the pulsing highlight should show */
  showHighlight: boolean;
  /** Whether the popover/dropdown is expanded */
  isExpanded: boolean;
  /** Whether alternatives section is expanded */
  showAlternatives: boolean;
  /** Accept the primary suggestion */
  acceptPrimary: () => void;
  /** Accept an alternative by index */
  acceptAlternative: (index: number) => void;
  /** Accept a custom name (user typed) */
  acceptCustom: (name: string) => void;
  /** Dismiss suggestions */
  dismiss: () => void;
  /** Expand the popover */
  expand: () => void;
  /** Collapse the popover */
  collapse: () => void;
  /** Toggle alternatives visibility */
  toggleAlternatives: () => void;
}

/**
 * Hook for consuming name suggestions in UI components.
 */
export function useNameSuggestions(): UseNameSuggestionsReturn {
  const setLayoutName = useLayoutStore((s) => s.setName);

  const {
    result,
    status,
    isExpanded,
    showAlternatives,
    triggerSource,
    accept,
    dismiss,
    expand,
    collapse,
    toggleAlternatives,
  } = useNameSuggestionStore(
    useShallow((s) => ({
      result: s.result,
      status: s.status,
      isExpanded: s.isExpanded,
      showAlternatives: s.showAlternatives,
      triggerSource: s.triggerSource,
      accept: s.accept,
      dismiss: s.dismiss,
      expand: s.expand,
      collapse: s.collapse,
      toggleAlternatives: s.toggleAlternatives,
    }))
  );

  const primarySuggestion = result?.primary ?? null;
  const alternatives = useMemo(() => result?.alternatives ?? [], [result?.alternatives]);
  const showHighlight = status === 'ready';

  /**
   * Track a suggestion event for telemetry.
   */
  const trackSuggestion = useCallback(
    (
      action: SuggestionTelemetryEvent['action'],
      suggestion: NameSuggestion,
      index: number,
      finalName?: string
    ) => {
      const event: SuggestionTelemetryEvent = {
        action,
        suggestionHash: hashName(suggestion.name),
        source: suggestion.source,
        confidence: suggestion.confidence,
        suggestionIndex: index,
        triggerSource: triggerSource ?? 'auto',
      };

      // Add edit distance if user edited the suggestion
      if (finalName && action === 'edited') {
        event.finalNameHash = hashName(finalName);
        event.editDistance = editDistance(suggestion.name, finalName);
      }

      trackEvent('name_suggestion', { ...event });
    },
    [triggerSource]
  );

  /**
   * Accept the primary suggestion.
   */
  const acceptPrimary = useCallback(() => {
    if (!primarySuggestion) return;

    setLayoutName(primarySuggestion.name);
    trackSuggestion('accepted', primarySuggestion, 0);
    accept();
  }, [primarySuggestion, setLayoutName, trackSuggestion, accept]);

  /**
   * Accept an alternative suggestion by index.
   */
  const acceptAlternative = useCallback(
    (index: number) => {
      const suggestion = alternatives[index];
      if (!suggestion) return;

      setLayoutName(suggestion.name);
      trackSuggestion('accepted', suggestion, index + 1);
      accept();
    },
    [alternatives, setLayoutName, trackSuggestion, accept]
  );

  /**
   * Accept a custom name typed by the user.
   * Tracks as "edited" if similar to primary suggestion.
   */
  const acceptCustom = useCallback(
    (name: string) => {
      if (!name.trim()) return;

      setLayoutName(name.trim());

      // Determine if this is an edit of the primary suggestion
      if (primarySuggestion) {
        const distance = editDistance(primarySuggestion.name, name);
        const maxLength = Math.max(primarySuggestion.name.length, name.length);
        const similarity = 1 - distance / maxLength;

        // If more than 50% similar, count as edit
        if (similarity > 0.5) {
          trackSuggestion('edited', primarySuggestion, 0, name);
        } else {
          // User typed something completely different - still track
          trackSuggestion('dismissed', primarySuggestion, 0);
        }
      }

      accept();
    },
    [primarySuggestion, setLayoutName, trackSuggestion, accept]
  );

  /**
   * Dismiss suggestions (tracks telemetry).
   */
  const handleDismiss = useCallback(() => {
    if (primarySuggestion) {
      trackSuggestion('dismissed', primarySuggestion, 0);
    }
    dismiss();
  }, [primarySuggestion, trackSuggestion, dismiss]);

  return {
    primarySuggestion,
    alternatives,
    showHighlight,
    isExpanded,
    showAlternatives,
    acceptPrimary,
    acceptAlternative,
    acceptCustom,
    dismiss: handleDismiss,
    expand,
    collapse,
    toggleAlternatives,
  };
}
