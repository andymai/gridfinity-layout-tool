/**
 * Hook that manages the engagement-gated feedback nudge toast.
 *
 * Checks the engagement gate periodically (every minute) and shows the
 * feedback-rating toast when criteria are met, with a 30-day cooldown.
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

/**
 * Mount this hook once at the app level. It records the session start on mount,
 * then periodically checks the engagement gate + cooldown and shows the
 * feedback nudge at most once per session.
 */
export function useEngagementNudges(): void {
  const t = useTranslation();
  const shownThisSession = useRef<Set<NudgeType>>(new Set());

  useEffect(() => {
    recordSessionStart();
  }, []);

  // Feedback nudge only. Ko-fi was deliberately removed from this timer-based
  // poll (it barely converted here) — the Ko-fi ask now lives in the header and
  // the export dialog's post-export success view.
  useEffect(() => {
    function checkAndShowNudge(): void {
      const nudgeOrder: NudgeType[] = ['feedback_rating'];

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
}
