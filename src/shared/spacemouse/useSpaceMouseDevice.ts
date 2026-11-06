import { useEffect } from 'react';
import { startSpaceMouse, stopSpaceMouse } from './deviceManager';
import { useSpaceMouseStore } from './settingsStore';

/**
 * Starts SpaceMouse device management while the Settings option is on. Mount
 * once, app-wide. Auto-reconnects to an already-paired device; pairing a new one
 * still needs a user gesture (see requestSpaceMousePairing).
 */
export function useSpaceMouseDevice(): void {
  const enabled = useSpaceMouseStore((s) => s.enabled);
  useEffect(() => {
    if (!enabled) return;
    startSpaceMouse();
    return () => stopSpaceMouse();
  }, [enabled]);
}
