import { useCallback, useSyncExternalStore } from 'react';
import { trackPwaInstallPromptResult } from '@/shared/analytics/posthog';
import type { PwaInstallPlacement } from '@/shared/analytics/posthog';
import {
  canPromptInstall,
  closeInstallOffer,
  promptInstall,
  subscribeInstallPrompt,
} from '@/shared/pwa/installPrompt';
import type { InstallOutcome } from '@/shared/pwa/installPrompt';

export interface InstallPrompt {
  canInstall: boolean;
  /** Call from a click handler: Chrome opens its dialog only on a user gesture. */
  install: () => Promise<InstallOutcome>;
}

export function useInstallPrompt(placement: PwaInstallPlacement): InstallPrompt {
  const canInstall = useSyncExternalStore(subscribeInstallPrompt, canPromptInstall, () => false);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    const outcome = await promptInstall();
    if (outcome === 'unavailable') return outcome;
    trackPwaInstallPromptResult(placement, outcome);
    // Chrome fires a fresh beforeinstallprompt right after a dismissal.
    if (outcome === 'dismissed') closeInstallOffer();
    return outcome;
  }, [placement]);

  return { canInstall, install };
}
