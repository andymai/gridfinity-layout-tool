import { useEffect } from 'react';
import { startSpaceMouse, stopSpaceMouse } from './deviceManager';

/**
 * Starts SpaceMouse device management while `enabled`. Mount once, app-wide,
 * gated on the labs flag. Auto-reconnects to an already-paired device; pairing a
 * new one still needs a user gesture (see requestSpaceMousePairing).
 */
export function useSpaceMouseDevice(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    startSpaceMouse();
    return () => stopSpaceMouse();
  }, [enabled]);
}
