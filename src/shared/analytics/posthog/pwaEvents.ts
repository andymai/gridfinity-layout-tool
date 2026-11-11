import {
  getDisplayMode,
  isInstalledDisplayMode,
  onDisplayModeChange,
  type DisplayMode,
} from '@/shared/pwa/displayMode';
import { markFeatureUsed } from './eventsPerson';
import { isFirstSession, loadAnalyticsData, saveAnalyticsData } from './identity';
import { getPosthogInstance, isAnalyticsActive } from './init';
import { trackEvent } from './trackEvent';

/**
 * Track PWA app installation via the `appinstalled` browser event.
 * Call once from the app shell — the listener fires at most once per install.
 */
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
  if (isInstalledDisplayMode(mode)) markFeatureUsed('pwa_standalone');
}

/**
 * Keeps the `display_mode` session property current (init registers the first
 * value) and records a launch from the installed app as a person property.
 */
export function listenForDisplayModeChanges(): void {
  try {
    noteInstalledLaunch(getDisplayMode());
    onDisplayModeChange((mode) => {
      getPosthogInstance()?.register_for_session({ display_mode: mode });
      noteInstalledLaunch(mode);
    });
  } catch {
    // Fail silently
  }
}
