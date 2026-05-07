import { useEffect, useMemo } from 'react';
import { layoutAdapter } from './adapters/layoutAdapter';
import { designAdapter } from '@/features/bin-designer/sync/designAdapter';
import { start, stop } from './engine';
import { useSessionLifecycle, useSessionStore } from './session/useSession';
import { useDebouncedPush } from './triggers/useDebouncedPush';
import { useVisibilityFlush } from './triggers/useVisibilityFlush';
import { useBeaconFlush } from './triggers/useBeaconFlush';
import { usePeriodicPoll } from './triggers/usePeriodicPoll';
import { useSyncToasts } from './useSyncToasts';
import type { SyncAdapters } from './adapters/types';

/**
 * Boot point for the sync feature. Runs only when SYNC_UI_ENABLED is on
 * (parent gates the whole mount). Owns:
 *
 *   - session lifecycle (auth bookkeeping)
 *   - engine start/stop tied to authenticated status
 *   - 4 trigger hooks (push debounce, visibility flush, beacon, poll)
 *   - toast subscriber
 *
 * Adapters are constructed once and shared across all hooks; the
 * DesignAdapter import is what brings the bin-designer feature into
 * the sync graph at this level (`shell/` → `core/sync/` → feature
 * import is allowed; `core/sync/` could not import the feature
 * directly).
 */
export function SyncSessionMount(): null {
  useSessionLifecycle();

  const adapters = useMemo<SyncAdapters>(
    () => ({ layouts: layoutAdapter, designs: designAdapter }),
    []
  );

  const status = useSessionStore((s) => s.status);

  useEffect(() => {
    if (status === 'authenticated') {
      start(adapters);
    } else if (status === 'anonymous') {
      stop();
    }
    return () => {
      stop();
    };
  }, [status, adapters]);

  useDebouncedPush();
  useVisibilityFlush();
  useBeaconFlush(adapters);
  usePeriodicPoll(adapters);
  useSyncToasts();

  return null;
}
