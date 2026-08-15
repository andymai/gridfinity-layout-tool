import { useCallback, useEffect, useState } from 'react';
import { useSessionStore } from '@/core/sync/session/useSession';
import {
  fetchSupporterStatus,
  isSupporterEditError,
  updateSupporterProfile,
  type SupporterEditError,
  type SupporterProfilePatch,
  type SupporterStatus,
} from '../api/supporterClient';

const ANONYMOUS: SupporterStatus = {
  supporter: false,
  badgePublic: false,
  name: null,
  message: null,
};

export interface UseSupporterStatus {
  status: SupporterStatus;
  /** False until the first read settles, so the panel doesn't guess a branch. */
  settled: boolean;
  save: (patch: SupporterProfilePatch) => Promise<SupporterEditError | null>;
}

/** A read tagged with the account it describes. */
interface TaggedStatus {
  userId: string;
  status: SupporterStatus;
}

/**
 * The signed-in caller's supporter record.
 *
 * Re-reads whenever the session changes rather than only on mount: the server
 * links a Ko-fi record lazily on this endpoint, so signing in — here or in
 * another tab — is exactly when a previously unmatched visitor becomes a
 * recognized supporter.
 *
 * The result is TAGGED with the user id it describes and read back through a
 * match, rather than cleared on sign-out. Same protection, but derived: an
 * effect that cleared it would be a synchronous setState, and the tag closes
 * the same hole an untagged cache would open — signing out and back in as
 * somebody else would otherwise show the previous account's name as settled
 * while the new read is still in flight.
 */
export function useSupporterStatus(): UseSupporterStatus {
  const sessionStatus = useSessionStore((state) => state.status);
  const userId = useSessionStore((state) => state.user?.userId);
  const [read, setRead] = useState<TaggedStatus | null>(null);

  useEffect(() => {
    // 'unknown' is the pre-flight state; asking now would answer for a session
    // that has not resolved yet.
    if (sessionStatus !== 'authenticated' || userId === undefined) return;
    const controller = new AbortController();
    let active = true;
    void fetchSupporterStatus(controller.signal).then((next) => {
      if (active) setRead({ userId, status: next });
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [sessionStatus, userId]);

  const current = read !== null && read.userId === userId ? read.status : null;
  const status = sessionStatus === 'authenticated' && current !== null ? current : ANONYMOUS;
  const settled =
    sessionStatus === 'anonymous' || (sessionStatus === 'authenticated' && current !== null);

  const save = useCallback(
    async (patch: SupporterProfilePatch): Promise<SupporterEditError | null> => {
      const result = await updateSupporterProfile(patch);
      if (isSupporterEditError(result)) return result;
      if (userId !== undefined) setRead({ userId, status: result });
      return null;
    },
    [userId]
  );

  return { status, settled, save };
}
