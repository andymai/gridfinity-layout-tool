import { useEffect } from 'react';
import { SPACEMOUSE_SETTINGS_STORAGE_KEY } from './constants';
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

  // Another tab's change has to land here too: this tab would keep probing, and
  // its next tuning or connection write would put the old opt-in back.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SPACEMOUSE_SETTINGS_STORAGE_KEY) void useSpaceMouseStore.persist.rehydrate();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
}
