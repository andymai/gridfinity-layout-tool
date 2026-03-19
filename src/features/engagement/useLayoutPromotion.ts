/**
 * Hook that shows a one-time toast nudge for engaged single-layout users,
 * encouraging them to create a second layout via the Layout Manager.
 *
 * Criteria: user has exactly 1 layout, 15+ bins on the grid, and passes
 * the engagement gate (3+ sessions, 3+ features, 10+ minutes).
 */

import { useEffect, useRef } from 'react';
import { useLibraryStore } from '@/core/store/library';
import { useLayoutStore } from '@/core/store/layout';
import { useViewStore } from '@/core/store/view';
import { useToastStore } from '@/core/store/toast';
import { shouldShowNudge, recordNudgeDismissal } from './engagementTracker';
import { trackEvent } from '@/shared/analytics/posthog';
import { useTranslation } from '@/i18n';
import { getGridBins } from '@/shared/utils';

const BIN_THRESHOLD = 15;
const CHECK_INTERVAL_MS = 60_000; // Re-check every minute (matches useEngagementNudges)
const FALLBACK_DISMISS_MS = 10_000;

export function useLayoutPromotion(): void {
  const shownRef = useRef(false);
  const t = useTranslation();

  // Plain scalar selectors -- no useShallow needed
  const layoutCount = useLibraryStore((s) => s.library.entries.length);
  const binCount = useLayoutStore((s) => getGridBins(s.layout.bins).length);

  useEffect(() => {
    function tryShow(): boolean {
      if (shownRef.current) return true;
      if (layoutCount !== 1) return false;
      if (binCount < BIN_THRESHOLD) return false;
      if (!shouldShowNudge('layout_promotion')) return false;

      shownRef.current = true;
      trackEvent('nudge_shown', { nudge_type: 'layout_promotion' });

      let dismissed = false;

      useToastStore.getState().addToast({
        message: t('engagement.layoutPromotion.message'),
        type: 'info',
        duration: 8000,
        action: {
          label: t('engagement.layoutPromotion.action'),
          onClick: () => {
            dismissed = true;
            trackEvent('nudge_clicked', { nudge_type: 'layout_promotion' });
            recordNudgeDismissal('layout_promotion');
            useViewStore.getState().setShowLayoutManager(true);
          },
        },
      });

      // Fallback dismissal timer (matches pattern from useEngagementNudges.ts)
      fallbackTimerId = setTimeout(() => {
        if (!dismissed) recordNudgeDismissal('layout_promotion');
      }, FALLBACK_DISMISS_MS);

      return true;
    }

    let fallbackTimerId: ReturnType<typeof setTimeout> | undefined;

    // Try immediately — if gate not met yet, re-check periodically
    // (engagement gate requires 10+ min session time, which may not be met on first render)
    if (!tryShow()) {
      const intervalId = setInterval(() => {
        if (tryShow()) clearInterval(intervalId);
      }, CHECK_INTERVAL_MS);

      return () => {
        clearInterval(intervalId);
        if (fallbackTimerId) clearTimeout(fallbackTimerId);
      };
    }

    return () => {
      if (fallbackTimerId) clearTimeout(fallbackTimerId);
    };
  }, [layoutCount, binCount, t]);
}
