import { useCallback, useEffect, useMemo, useState } from 'react';
import { layoutAdapter } from '@/core/sync/adapters/layoutAdapter';
import { designAdapter } from '@/features/bin-designer';
import { runClaim, type AccountMismatchChoice } from '@/core/sync/claim';
import { start, stop } from '@/core/sync/engine';
import { useSessionLifecycle, useSessionStore } from '@/core/sync/session/useSession';
import { useDebouncedPush } from '@/core/sync/triggers/useDebouncedPush';
import { useVisibilityFlush } from '@/core/sync/triggers/useVisibilityFlush';
import { useBeaconFlush } from '@/core/sync/triggers/useBeaconFlush';
import { usePeriodicPoll } from '@/core/sync/triggers/usePeriodicPoll';
import { useSyncToasts } from '@/core/sync/useSyncToasts';
import { AccountMismatchDialog } from '@/core/sync/dialogs/AccountMismatchDialog';
import type { SyncAdapters } from '@/core/sync/adapters/types';

/**
 * Boot point for the sync feature. Mounted only when the user has
 * enabled the `cloud_sync` Labs flag (parent gates the whole mount).
 * Owns:
 *
 *   - session lifecycle (auth bookkeeping)
 *   - engine start/stop tied to authenticated status
 *   - first-sign-in claim flow (anonymous → authenticated)
 *   - account-mismatch dialog
 *   - 4 trigger hooks
 *   - toast subscriber
 */
export function SyncSessionMount() {
  useSessionLifecycle();

  const adapters = useMemo<SyncAdapters>(
    () => ({ layouts: layoutAdapter, designs: designAdapter }),
    []
  );

  const status = useSessionStore((s) => s.status);

  const [mismatchPrompt, setMismatchPrompt] = useState<{
    localCount: number;
    newAccountLabel: string;
    resolve: (choice: AccountMismatchChoice) => void;
  } | null>(null);

  const promptAccountMismatch = useCallback(
    (input: { localCount: number; newUserId: string; newAccountLabel: string }) =>
      new Promise<AccountMismatchChoice>((resolve) => {
        setMismatchPrompt({
          localCount: input.localCount,
          newAccountLabel: input.newAccountLabel,
          resolve,
        });
      }),
    []
  );

  useEffect(() => {
    if (status !== 'authenticated') return;

    // Read user via getState() so this effect doesn't depend on the
    // user reference — Zustand may emit a new user object while
    // status stays 'authenticated', which would otherwise restart
    // the engine for no reason.
    const currentUser = useSessionStore.getState().user;
    // Contract: if status === 'authenticated' the user object is
    // populated atomically. If we ever observe an intermediate state
    // where it isn't, do nothing — starting the engine without a
    // user would immediately 401 and skip the claim flow entirely.
    // The next session emission will retrigger this effect.
    if (!currentUser) return;

    let cancelled = false;
    // Run claim before start(): the engine drains outbox and polls
    // immediately, and we don't want the prior user's pending
    // pushes to flush under the new account before discard can
    // wipe them. runClaim is single-flight per userId so a
    // StrictMode-style double effect run coalesces.
    void runClaim({
      adapters,
      userId: currentUser.userId,
      newAccountLabel: currentUser.email,
      promptAccountMismatch,
    }).then((result) => {
      // Skip engine start on 'unauthorized': the manifest 401 means
      // session sort-out is in flight (the engine's own forced-401
      // handler will flip to anonymous), and starting now would
      // immediately retrigger that path. Other terminal states
      // ('merged' | 'discarded' | 'error') start the engine —
      // 'error' relies on the engine's own retry/backoff to recover.
      if (cancelled) return;
      if (result.status !== 'unauthorized') start(adapters);
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [status, adapters, promptAccountMismatch]);

  useDebouncedPush();
  useVisibilityFlush();
  useBeaconFlush(adapters);
  usePeriodicPoll(adapters);
  useSyncToasts();

  if (mismatchPrompt) {
    return (
      <AccountMismatchDialog
        isOpen={true}
        localCount={mismatchPrompt.localCount}
        newAccountLabel={mismatchPrompt.newAccountLabel}
        onChoice={(choice) => {
          mismatchPrompt.resolve(choice);
          setMismatchPrompt(null);
        }}
      />
    );
  }
  return null;
}
