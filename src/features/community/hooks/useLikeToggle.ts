import { useCallback, useRef } from 'react';
import { isOk } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import type { CommunityCard } from '@/shared/types/community';
import { setDesignLiked } from '../api/client';
import { useBrowseStore } from '../store/browseStore';
import type { CardLikePatch } from '../store/browseStore';

export type LikeToggleOutcome = 'ok' | 'signin-required' | 'error';

export type LikeToggleTarget = Pick<CommunityCard, 'id' | 'likedByMe' | 'counts'>;

interface LikeFlight {
  /** Latest toggle direction the user asked for. */
  desired: boolean;
}

/**
 * Shared optimistic like toggle for the card footer and the detail stats
 * row. Patches the browse store immediately, replaces the count with the
 * server's authoritative value on success, and rolls back on failure. A
 * signed-out tap returns 'signin-required' so the caller can open the
 * sign-in prompt (the pending-action record is saved there, on the actual
 * provider choice, not on the tap).
 *
 * A tap while a request for the same design is in flight coalesces into the
 * flight: it patches optimistically right away and the flight sends one more
 * request for the final desired state, so a quick like-then-unlike cannot be
 * silently dropped.
 *
 * `onPatch` mirrors every store patch to the caller: the detail view needs
 * it because a design beyond the browse index cap has no store card, so its
 * local stats state is the only thing the optimistic patch can land on.
 */
export function useLikeToggle(): (
  card: LikeToggleTarget,
  onPatch?: (patch: CardLikePatch) => void
) => Promise<LikeToggleOutcome> {
  const t = useTranslation();
  const sessionStatus = useSessionStore((s) => s.status);
  const patchCardLike = useBrowseStore((s) => s.patchCardLike);
  const flightsRef = useRef<Map<string, LikeFlight>>(new Map());

  return useCallback(
    async (
      card: LikeToggleTarget,
      onPatch?: (patch: CardLikePatch) => void
    ): Promise<LikeToggleOutcome> => {
      if (sessionStatus !== 'authenticated') {
        trackEvent('community_signin_prompt_shown', { intent: 'like' });
        return 'signin-required';
      }
      const applyPatch = (patch: CardLikePatch) => {
        patchCardLike(card.id, patch);
        onPatch?.(patch);
      };
      const wasLiked = card.likedByMe === true;
      const nextLiked = !wasLiked;
      applyPatch({
        likedByMe: nextLiked,
        likes: Math.max(0, card.counts.likes + (nextLiked ? 1 : -1)),
      });
      const inFlight = flightsRef.current.get(card.id);
      if (inFlight !== undefined) {
        inFlight.desired = nextLiked;
        return 'ok';
      }
      const flight: LikeFlight = { desired: nextLiked };
      flightsRef.current.set(card.id, flight);
      try {
        for (;;) {
          const sent = flight.desired;
          const result = await setDesignLiked(card.id, sent);
          if (isOk(result)) {
            // A coalesced tap reversed the direction mid-flight; follow up
            // with the final desired state instead of adopting a stale value.
            if (flight.desired !== sent) continue;
            applyPatch({
              likedByMe: result.value.likedByMe,
              likes: result.value.likes,
            });
            trackEvent(sent ? 'community_like' : 'community_unlike');
            return 'ok';
          }
          applyPatch({ likedByMe: wasLiked, likes: card.counts.likes });
          if (result.error.kind === 'needsAuth') {
            trackEvent('community_signin_prompt_shown', { intent: 'like' });
            return 'signin-required';
          }
          useToastStore.getState().addToast({
            message: t('community.toast.likeFailed'),
            type: 'error',
          });
          return 'error';
        }
      } finally {
        flightsRef.current.delete(card.id);
      }
    },
    [patchCardLike, sessionStatus, t]
  );
}
