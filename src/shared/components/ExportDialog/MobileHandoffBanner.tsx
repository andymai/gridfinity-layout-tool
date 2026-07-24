/**
 * "Continue on desktop" offer shown inside export dialogs on mobile for
 * anonymous users. Mobile users create at a healthy rate but almost never
 * download files — signing in syncs their work to their account so they can
 * finish from a desktop browser. Direct mobile export stays available.
 */

import { useEffect } from 'react';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useSessionStore } from '@/core/sync/session/useSession';
import { signInUrl } from '@/core/sync/session/sessionApi';
import { trackEvent } from '@/shared/analytics/posthog';
import { useTranslation } from '@/i18n';

export function MobileHandoffBanner() {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const status = useSessionStore((s) => s.status);

  const visible = isMobile && status === 'anonymous';

  useEffect(() => {
    if (visible) {
      trackEvent('mobile_handoff', { action: 'shown' });
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="mt-3 rounded-lg border border-stroke-subtle bg-surface p-3">
      <p className="text-xs text-content-secondary leading-relaxed">
        {t('export.mobileHandoff.message')}
      </p>
      <div className="mt-2 flex gap-2">
        <a
          href={signInUrl('google')}
          onClick={() =>
            trackEvent('mobile_handoff', { action: 'signin_clicked', provider: 'google' })
          }
          className="flex-1 rounded-md border border-stroke-subtle px-2 py-1.5 text-center text-xs font-medium text-content hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
        >
          {t('auth.signInWithGoogle')}
        </a>
        <a
          href={signInUrl('github')}
          onClick={() =>
            trackEvent('mobile_handoff', { action: 'signin_clicked', provider: 'github' })
          }
          className="flex-1 rounded-md border border-stroke-subtle px-2 py-1.5 text-center text-xs font-medium text-content hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
        >
          {t('auth.signInWithGithub')}
        </a>
      </div>
    </div>
  );
}
