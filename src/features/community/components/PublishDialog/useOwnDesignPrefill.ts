/**
 * Update-mode reconciliation: fetch the live published record so the form
 * edits what is actually public rather than whatever the local copy happens to
 * say, and decide what a 404 means.
 *
 * Kept out of the dialog because the 404 branch is the subtle part and
 * deserves to be readable and testable on its own.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { useCommunityPublishStore } from '@/core/store/communityPublish';
import { useToastStore } from '@/core/store/toast';
import { getMe } from '@/core/sync/session/sessionApi';
import type { SessionStatus } from '@/core/sync/session/useSession';
import { fetchOwnDesign } from '../../api/client';
import { usePublishDialogStore } from '../../store/publishStore';
import type { PublishPrefill } from '../../store/publishStore';

export interface OwnDesignPrefill {
  /** Live name/description/category, null until the fetch resolves. */
  prefill: PublishPrefill | null;
  /** Promoted print photo on the card, '' for the render. */
  coverUrl: string;
  pending: boolean;
  /** The record could not be read, so editing it would overwrite it blind. */
  failed: boolean;
  retry: () => void;
}

export function useOwnDesignPrefill(
  publishedId: string | null,
  sessionStatus: SessionStatus
): OwnDesignPrefill {
  const t = useTranslation();
  const [prefill, setPrefill] = useState<PublishPrefill | null>(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [resolved, setResolved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (publishedId === null) return;
    // Prefill/reconcile only makes sense for a recognized owner. Skipping it
    // while signed out avoids a 404 (expected then) severing the link.
    if (sessionStatus !== 'authenticated') return;
    let cancelled = false;
    void fetchOwnDesign(publishedId).then((result) => {
      if (cancelled) return;
      if (isOk(result)) {
        setPrefill({
          name: result.value.name,
          description: result.value.description,
          category: result.value.category,
        });
        setCoverUrl(result.value.coverPhotoUrl ?? '');
        setResolved(true);
        return;
      }
      if (result.error.kind === 'notFound') {
        // A 404 is definitive only from a recognized owner: the API also 404s
        // a hidden-but-recoverable design to an expired cookie. Confirm the
        // session is live before severing the local publishedId link, mirroring
        // publishedIdReconcile. On an unconfirmed session, keep the link and
        // block the form rather than mint a duplicate.
        void getMe().then(
          (me) => {
            if (cancelled) return;
            if (me === null) {
              setFailed(true);
              setResolved(true);
              return;
            }
            const publish = useCommunityPublishStore.getState();
            publish.handlers?.onUnpublished();
            publish.clearContextPublishedId();
            usePublishDialogStore.getState().switchToCreate();
            useToastStore.getState().addToast({
              message: t('community.publish.error.republishAsNew'),
              type: 'info',
            });
            setResolved(true);
          },
          () => {
            // A network failure confirming the session leaves it unconfirmed,
            // like a null session: keep the link and block the form. Without
            // this arm the getMe rejection escapes as an unhandled rejection.
            if (cancelled) return;
            setFailed(true);
            setResolved(true);
          }
        );
        return;
      }
      // Without the live record, submitting would overwrite the published
      // name/description with local defaults; block the form instead.
      setFailed(true);
      setResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, [publishedId, attempt, sessionStatus, t]);

  // Derived, not latched. A signed-out caller has nothing to wait for, since
  // the effect skips the fetch entirely; an initial `pending` would hang update
  // mode behind a spinner that never clears. `unknown` still waits, because the
  // session may yet resolve to authenticated.
  const pending = publishedId !== null && sessionStatus !== 'anonymous' && !resolved;

  const retry = () => {
    setFailed(false);
    setResolved(false);
    setAttempt((value) => value + 1);
  };

  return { prefill, coverUrl, pending, failed, retry };
}
