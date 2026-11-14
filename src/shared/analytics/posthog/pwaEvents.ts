import {
  getDisplayMode,
  isInstalledDisplayMode,
  onDisplayModeChange,
  type DisplayMode,
} from '@/shared/pwa/displayMode';
import type { InstallOutcome } from '@/shared/pwa/installPrompt';
import { markFeatureUsed } from './eventsPerson';
import { isFirstSession, loadAnalyticsData, saveAnalyticsData } from './identity';
import { isAnalyticsActive } from './init';
import { trackEvent } from './trackEvent';

export function listenForPwaInstall(): void {
  try {
    window.addEventListener(
      'appinstalled',
      () => {
        trackEvent('pwa_installed', {
          is_first_session: isFirstSession(),
        });
        markFeatureUsed('pwa_installed');
      },
      { once: true }
    );
  } catch {
    // Fail silently
  }
}

/**
 * Chrome fires `beforeinstallprompt` on every load while the app is installable
 * and not installed, so this sends at most one event per browser per day.
 * Attach it at boot, not after PostHog loads: the event can fire first.
 */
export function listenForPwaInstallAvailability(): void {
  try {
    window.addEventListener('beforeinstallprompt', () => {
      if (!isAnalyticsActive()) return;
      const today = new Date().toISOString().slice(0, 10);
      const data = loadAnalyticsData();
      if (data.pwaInstallAvailableDay === today) return;
      data.pwaInstallAvailableDay = today;
      saveAnalyticsData(data);
      trackEvent('pwa_install_available', { is_first_session: isFirstSession() });
    });
  } catch {
    // Fail silently
  }
}

function noteInstalledLaunch(mode: DisplayMode): void {
  if (isAnalyticsActive() && isInstalledDisplayMode(mode)) markFeatureUsed('pwa_standalone');
}

export function noteCurrentDisplayMode(): void {
  try {
    noteInstalledLaunch(getDisplayMode());
  } catch {
    // Fail silently
  }
}

export function listenForDisplayModeChanges(): void {
  try {
    noteCurrentDisplayMode();
    onDisplayModeChange(noteInstalledLaunch);
  } catch {
    // Fail silently
  }
}

export type PwaInstallPlacement = 'export_success' | 'settings';

export function trackPwaInstallPromptShown(placement: PwaInstallPlacement): void {
  trackEvent('pwa_install_prompt_shown', { placement });
}

export function trackPwaInstallPromptResult(
  placement: PwaInstallPlacement,
  outcome: InstallOutcome
): void {
  trackEvent('pwa_install_prompt_result', { placement, outcome });
}

export function trackPwaInstallOfferClosed(placement: PwaInstallPlacement): void {
  trackEvent('pwa_install_offer_closed', { placement });
}
