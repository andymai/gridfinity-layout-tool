import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { layoutAdapter } from './adapters/layoutAdapter';
import { designAdapter } from '@/features/bin-designer/sync/designAdapter';
import { runClaim, type AccountMismatchChoice } from './claim';
import { start, stop } from './engine';
import { useSessionLifecycle, useSessionStore } from './session/useSession';
import { useDebouncedPush } from './triggers/useDebouncedPush';
import { useVisibilityFlush } from './triggers/useVisibilityFlush';
import { useBeaconFlush } from './triggers/useBeaconFlush';
import { usePeriodicPoll } from './triggers/usePeriodicPoll';
import { useSyncToasts } from './useSyncToasts';
import { AccountMismatchDialog } from './dialogs/AccountMismatchDialog';
import type { SyncAdapters } from './adapters/types';

/**
 * Boot point for the sync feature. Runs only when SYNC_UI_ENABLED is on
 * (parent gates the whole mount). Owns:
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
  // Always seed with 'unknown' so a remount-while-authenticated (StrictMode
  // double-invoke, conditional unmount, etc.) still hits the transition
  // branch and starts the engine. Using `useRef(status)` would skip start()
  // because prev === status on first run.
  const prevStatusRef = useRef<typeof status>('unknown');

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
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === 'authenticated' && prev !== 'authenticated') {
      // Read user via getState() so this effect doesn't depend on the
      // user reference — Zustand may emit a new user object while
      // status stays 'authenticated', which would otherwise stop()
      // the engine without a matching start() (the next effect run
      // sees prev === 'authenticated' and falls through both branches).
      const currentUser = useSessionStore.getState().user;
      if (currentUser) {
        // Run claim before start(): the engine drains outbox and polls
        // immediately, and we don't want the prior user's pending
        // pushes to flush under the new account before discard can
        // wipe them.
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
          if (result.status !== 'unauthorized') start(adapters);
        });
      } else {
        start(adapters);
      }
    } else if (status === 'anonymous' && prev === 'authenticated') {
      stop();
    }
    return () => {
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
