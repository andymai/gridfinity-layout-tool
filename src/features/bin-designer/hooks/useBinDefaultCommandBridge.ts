/**
 * Bridges the command-palette "bin default" commands into the designer.
 *
 * The command palette lives in another feature and cannot import bin-designer
 * (cross-feature boundary), so its `set-bin-default` / `reset-bin-default`
 * commands dispatch window events. This hook — mounted once by `DesignerPage`,
 * where live params exist — listens for them and runs the shared actions.
 */

import { useEffect } from 'react';
import { useBinDefaults } from './useBinDefaults';

const SET_EVENT = 'bin-designer:set-default';
const RESET_EVENT = 'bin-designer:reset-default';

export function useBinDefaultCommandBridge(): void {
  const { setCurrentAsDefault, resetToFactory } = useBinDefaults();

  useEffect(() => {
    const onSet = (): void => setCurrentAsDefault();
    const onReset = (): void => resetToFactory();
    window.addEventListener(SET_EVENT, onSet);
    window.addEventListener(RESET_EVENT, onReset);
    return () => {
      window.removeEventListener(SET_EVENT, onSet);
      window.removeEventListener(RESET_EVENT, onReset);
    };
  }, [setCurrentAsDefault, resetToFactory]);
}
