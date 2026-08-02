import { useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useBinExampleGalleryStore } from '@/core/store/binExampleGallery';
import { useCommunityDetailStore } from '@/core/store/communityDetail';
import { useToastStore } from '@/core/store/toast';
import { trackEvent } from '@/shared/analytics/posthog';
import { loadPendingLikeAction } from '@/shared/utils/communityPendingLikeAction';
import type { PendingLikeAction } from '@/shared/utils/communityPendingLikeAction';
import {
  loadCommunityReopenDesign,
  loadCommunityReturnPath,
} from '@/shared/utils/communityReturnPath';
import { useFeatureFlag } from './useFeatureFlag';
import { dispatchSyntheticPopstate } from './useDesignerRouting';

type Translate = (key: string) => string;

async function applyPendingLike(pending: PendingLikeAction, t: Translate): Promise<void> {
  // Dynamic imports keep the community client and browse store out of the
  // eager bundle: this hook mounts on every boot, the imports only load on
  // the one boot that returns from a like-initiated OAuth redirect.
  const [{ setDesignLiked }, { useBrowseStore }] = await Promise.all([
    import('@/features/community/api/client'),
    import('@/features/community/store/browseStore'),
  ]);
  const result = await setDesignLiked(pending.designId, pending.liked);
  if (isOk(result)) {
    useBrowseStore.getState().patchCardLike(pending.designId, {
      likedByMe: result.value.likedByMe,
      likes: result.value.likes,
    });
    // The reopened detail fetches concurrently and can snapshot a likedByMe
    // that raced this write; the sync record lets it adopt the resolved value.
    useCommunityDetailStore.getState().syncLike({
      designId: pending.designId,
      likedByMe: result.value.likedByMe,
      likes: result.value.likes,
    });
    trackEvent(pending.liked ? 'community_like' : 'community_unlike', { resumed: true });
    useToastStore.getState().addToast({
      message: t(pending.liked ? 'community.toast.likeSaved' : 'community.toast.unlikeSaved'),
      type: 'success',
    });
  } else {
    useToastStore.getState().addToast({
      message: t('community.toast.likeFailed'),
      type: 'error',
    });
  }
}

/**
 * Resumes a signed-out community action after the OAuth round trip. The
 * callback always lands on `/`, so this mounts at app level (like
 * useCommunityPublishReturn), restores the stashed /community origin (a like
 * or report started on the route surface must not strand the visitor in the
 * layout planner), and consumes the one-shot pending like once the session
 * resolves.
 */
export function useCommunityLikeReturn(): void {
  const t = useTranslation();
  const enabled = useFeatureFlag('community_showcase');
  const sessionStatus = useSessionStore((s) => s.status);

  useEffect(() => {
    if (!enabled) return;
    if (sessionStatus === 'unknown') return;
    // Navigate back regardless of the sign-in outcome: an abandoned redirect
    // still returns a visitor who was browsing the community.
    const returnPath = loadCommunityReturnPath();
    if (returnPath !== null && window.location.pathname + window.location.search !== returnPath) {
      window.history.pushState(null, '', returnPath);
      dispatchSyntheticPopstate();
    }
    // Gallery-tab surface: no URL carries the context, so reopen the gallery
    // and the detail the action started from. This happens regardless of the
    // sign-in outcome, mirroring the route restore above, so an abandoned
    // report sign-in still lands back on the design.
    const reopenDesignId = loadCommunityReopenDesign();
    if (reopenDesignId !== null) {
      useBinExampleGalleryStore.getState().open();
      useCommunityDetailStore.getState().open(reopenDesignId);
    }
    const pending = loadPendingLikeAction();
    if (pending === null) return;
    if (sessionStatus !== 'authenticated') {
      // Sign-in was abandoned mid-redirect; say so instead of silently
      // dropping the like the user expected.
      useToastStore.getState().addToast({
        message: t('community.toast.likeSigninIncomplete'),
        type: 'info',
      });
      return;
    }
    void applyPendingLike(pending, t);
  }, [enabled, sessionStatus, t]);
}
