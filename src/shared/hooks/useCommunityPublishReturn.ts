import { useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useToastStore } from '@/core/store/toast';
import {
  clearPendingPublishAction,
  peekPendingPublishAction,
} from '@/shared/utils/communityPendingAction';
import { useFeatureFlag } from './useFeatureFlag';
import { dispatchSyntheticPopstate } from './useDesignerRouting';

function onDesignerRoute(designId: string): boolean {
  const path = window.location.pathname;
  if (path !== '/designer' && path !== '/designer/') return false;
  return new URLSearchParams(window.location.search).get('id') === designId;
}

/**
 * The OAuth callback always redirects to `/`, so the surface that stashed a
 * pending publish action is not mounted when the user returns. Mounted at app
 * level, this hook navigates back to that surface once the session resolves;
 * the surface's own lifecycle hook then consumes the record and reopens the
 * publish dialog.
 */
export function useCommunityPublishReturn(): void {
  const t = useTranslation();
  const enabled = useFeatureFlag('community_showcase');
  const sessionStatus = useSessionStore((s) => s.status);

  useEffect(() => {
    if (!enabled) return;
    if (sessionStatus === 'unknown') return;
    const pending = peekPendingPublishAction();
    if (pending === null) return;
    if (sessionStatus !== 'authenticated') {
      // Sign-in was abandoned mid-redirect; say so instead of silently never
      // reopening the publish dialog the user expected.
      clearPendingPublishAction();
      useToastStore.getState().addToast({
        message: t('community.toast.signinIncomplete'),
        type: 'info',
      });
      return;
    }
    if (pending.returnSurface !== 'designer') return;
    if (onDesignerRoute(pending.designId)) return;
    const url = `/designer?id=${encodeURIComponent(pending.designId)}`;
    window.history.pushState({ designId: pending.designId }, '', url);
    dispatchSyntheticPopstate();
  }, [enabled, sessionStatus, t]);
}
