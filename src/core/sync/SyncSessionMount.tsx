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
  const user = useSessionStore((s) => s.user);
  const prevStatusRef = useRef(status);

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
      start(adapters);
      if (user) {
        void runClaim({
          adapters,
          userId: user.userId,
          newAccountLabel: user.email,
          promptAccountMismatch,
        });
      }
    } else if (status === 'anonymous' && prev === 'authenticated') {
      stop();
    }
    return () => {
      stop();
    };
  }, [status, user, adapters, promptAccountMismatch]);

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
