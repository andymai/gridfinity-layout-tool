/**
 * Hook that manages engagement-gated nudge toasts.
 *
 * Checks the engagement gate periodically (every minute) and shows
 * feedback rating or Ko-fi support toasts when criteria are met.
 * Each nudge type has an independent 30-day cooldown.
 */

import { useEffect, useRef } from 'react';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import {
  shouldShowNudge,
  recordNudgeDismissal,
  recordSessionStart,
  type NudgeType,
} from './engagementTracker';

const CHECK_INTERVAL_MS = 60_000; // Re-check every minute
const KOFI_URL = 'https://ko-fi.com/andyaragon';

/**
 * Mount this hook once at the app level. It:
 * 1. Records the session start on mount
 * 2. Periodically checks engagement gate + cooldowns
 * 3. Shows at most one nudge per session (feedback first, then Ko-fi)
 */
export function useEngagementNudges(): void {
  const t = useTranslation();
  const shownThisSession = useRef<Set<NudgeType>>(new Set());

  useEffect(() => {
    recordSessionStart();
  }, []);

  useEffect(() => {
    function checkAndShowNudge(): void {
      // Only show one nudge per check cycle — prioritize feedback
      const nudgeOrder: NudgeType[] = ['feedback_rating', 'kofi_support'];

      for (const nudgeType of nudgeOrder) {
        if (shownThisSession.current.has(nudgeType)) continue;
        if (!shouldShowNudge(nudgeType)) continue;

        shownThisSession.current.add(nudgeType);
        showNudgeToast(nudgeType, t);
        trackEvent('nudge_shown', { nudge_type: nudgeType });
        break; // Only one nudge per cycle
      }
    }

    // Initial check after a brief delay (let the user settle in)
    const initialDelay = setTimeout(checkAndShowNudge, CHECK_INTERVAL_MS);

    // Periodic re-checks (in case session time wasn't met initially)
    const interval = setInterval(checkAndShowNudge, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [t]);
}

function showNudgeToast(nudgeType: NudgeType, t: (key: string) => string): void {
  const addToast = useToastStore.getState().addToast;

  let dismissed = false;

  if (nudgeType === 'feedback_rating') {
    addToast({
      message: t('engagement.feedbackNudge'),
      type: 'info',
      duration: 0, // Persistent — user must dismiss
      action: {
        label: t('engagement.giveFeedback'),
        onClick: () => {
          dismissed = true;
          trackEvent('nudge_clicked', { nudge_type: 'feedback_rating' });
          recordNudgeDismissal('feedback_rating');
          window.open(
            'https://github.com/andymai/gridfinity-layout-tool/issues/new?template=feature_request.md',
            '_blank',
            'noopener,noreferrer'
          );
        },
      },
    });
    // Fallback: if the user doesn't click the action, start cooldown after 30s
    setTimeout(() => {
      if (!dismissed) recordNudgeDismissal('feedback_rating');
    }, 30_000);
  }

  if (nudgeType === 'kofi_support') {
    addToast({
      message: t('engagement.kofiNudge'),
      type: 'info',
      duration: 0,
      action: {
        label: t('engagement.support'),
        onClick: () => {
          dismissed = true;
          trackEvent('nudge_clicked', { nudge_type: 'kofi_support' });
          recordNudgeDismissal('kofi_support');
          window.open(KOFI_URL, '_blank', 'noopener,noreferrer');
        },
      },
    });
    setTimeout(() => {
      if (!dismissed) recordNudgeDismissal('kofi_support');
    }, 30_000);
  }
}
