import { useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n';
import { useCommunityDigestStore } from '@/core/store/communityDigest';
import { useToastStore } from '@/core/store/toast';
import { useSessionStore } from '@/core/sync/session/useSession';
import { trackEvent } from '@/shared/analytics/posthog';
import type { CommunityMilestoneKind } from '@/shared/types/community';
import { useFeatureFlag } from './useFeatureFlag';

/** Longer than the 5s default: a milestone deserves more read time than a routine toast. */
const MILESTONE_TOAST_DURATION_MS = 8000;

const MILESTONE_MESSAGE_KEYS: Record<CommunityMilestoneKind, string> = {
  first_publish: 'community.milestone.firstPublish',
  first_remix_of_yours: 'community.milestone.firstRemix',
  ten_published_remixes: 'community.milestone.tenRemixes',
  hundred_prints: 'community.milestone.hundredPrints',
};

/**
 * App-level driver for the since-last-visit digest and milestone toasts
 * (plan §2.6). Mounted once in App.tsx like useCommunityPublishReturn; does
 * nothing while the community_showcase flag is off or the visitor is signed
 * out, and re-runs when a mid-session sign-in flips the session state.
 *
 * The community modules load via dynamic import so this boot-path hook keeps
 * them out of the eager bundle; only signed-in flag users pay for the chunk.
 */
export function useCommunityDigestCheck(): void {
  const t = useTranslation();
  const enabled = useFeatureFlag('community_showcase');
  const sessionStatus = useSessionStore((s) => s.status);
  const userId = useSessionStore((s) => s.user?.userId ?? null);

  // Sign-out cleanup for the per-user community caches. Latched only while
  // the flag is on AND the user is authenticated: the stores can only hold
  // data if a signed-in flag user was here, so an anonymous boot or a
  // flag-off sign-out (e.g. a cloud-sync-only user) never pays for the
  // community chunk. Latching, rather than reading `enabled` at sign-out,
  // still cleans up when the flag flips off mid-session after the stores
  // were populated. Without the cleanup, the previous account's mine cache
  // (hidden designs, owner-only stats) survives into the next sign-in on a
  // shared browser, and a persisted mineOnly filter would land the next
  // user on it directly.
  const hadCommunitySessionRef = useRef(false);
  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      if (enabled) hadCommunitySessionRef.current = true;
      return;
    }
    if (sessionStatus !== 'anonymous' || !hadCommunitySessionRef.current) return;
    hadCommunitySessionRef.current = false;
    void Promise.all([
      import('@/features/community/store/mineStore'),
      import('@/features/community/store/browseStore'),
    ]).then(([mine, browse]) => {
      mine.useMineStore.getState().reset();
      browse.useBrowseStore.getState().setMineOnly(false);
    });
  }, [sessionStatus, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (sessionStatus === 'anonymous') {
      // A stale dot must not survive sign-out on a shared browser.
      useCommunityDigestStore.getState().reset();
      return;
    }
    if (sessionStatus !== 'authenticated' || userId === null) return;
    let cancelled = false;
    void Promise.all([
      import('@/features/community/utils/communityDigestCheck'),
      import('@/features/community/utils/communityMilestones'),
    ]).then(async ([{ runCommunityDigestCheck }, { claimMilestone }]) => {
      const due = await runCommunityDigestCheck(userId);
      if (cancelled) return;
      for (const kind of due) {
        // Claim and celebrate in one synchronous block: claimMilestone is the
        // once-only gate within this tab, so a concurrent pass here can never
        // toast the same kind (cross-tab claims can still race — see
        // claimMilestone's doc).
        if (!claimMilestone(userId, kind)) continue;
        trackEvent('community_milestone', { kind });
        useToastStore.getState().addToast({
          message: t(MILESTONE_MESSAGE_KEYS[kind]),
          type: 'success',
          duration: MILESTONE_TOAST_DURATION_MS,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, sessionStatus, userId, t]);
}
