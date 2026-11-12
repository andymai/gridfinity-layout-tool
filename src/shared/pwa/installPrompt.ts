import { getDisplayMode, isInstalledDisplayMode } from './displayMode';

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

const OFFER_STORAGE_KEY = 'gridfinity-install-offer-v1';
const OFFER_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;
const INSTALLED_STORAGE_KEY = 'gridfinity-app-installed-v1';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function rememberInstalled(): void {
  try {
    localStorage.setItem(INSTALLED_STORAGE_KEY, 'true');
  } catch {
    // Best effort: without storage, Settings shows the browser's install route.
  }
}

/**
 * Chrome fires no event that says the app is installed when the page runs in
 * a tab, so remember an install, or a launch from the app, in this browser.
 */
export function wasAppInstalled(): boolean {
  try {
    return localStorage.getItem(INSTALLED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Call at boot: Chrome can fire `beforeinstallprompt` before React mounts.
 * The event is kept but not `preventDefault()`ed, so Chrome's own install UI
 * (the Android mini-infobar) stays as it is.
 */
export function captureInstallPrompt(): void {
  if (isInstalledDisplayMode(getDisplayMode())) rememberInstalled();
  window.addEventListener('beforeinstallprompt', (event) => {
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    rememberInstalled();
    notify();
  });
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

export async function promptInstall(): Promise<InstallOutcome> {
  const event = deferredPrompt;
  if (!event) return 'unavailable';
  // An event can open its dialog once.
  deferredPrompt = null;
  notify();
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    // Chrome rejects a prompt() outside a user gesture or on a used event.
    return 'unavailable';
  }
}

export function isInstallOfferClosed(now: number = Date.now()): boolean {
  try {
    const closedAt = Number(localStorage.getItem(OFFER_STORAGE_KEY));
    return closedAt > 0 && now - closedAt < OFFER_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function closeInstallOffer(now: number = Date.now()): void {
  try {
    localStorage.setItem(OFFER_STORAGE_KEY, String(now));
  } catch {
    // Best effort: without storage the offer can show again.
  }
}
