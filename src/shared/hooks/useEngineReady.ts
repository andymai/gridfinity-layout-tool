/**
 * Reactive engine readiness for export buttons.
 *
 * A render-time `getActiveBridge() !== null` freezes whatever the bridge
 * happened to be at that moment: a render landing in the window where
 * `bridgeManager.refresh()` has nulled the bridge leaves the button disabled
 * with nothing to re-render it when the new worker boots. The subscription
 * fires synchronously with the current state and on every transition, which
 * is the same wiring `useExport` has always had.
 */

import { useEffect, useState } from 'react';
import { bridgeManager } from '@/shared/generation/bridge';

export function useEngineReady(): boolean {
  const [ready, setReady] = useState(() => bridgeManager.engineReady);
  useEffect(() => bridgeManager.subscribe(setReady), []);
  return ready;
}
