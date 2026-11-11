interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

const OFFER_STORAGE_KEY = 'gridfinity-install-offer-v1';
const OFFER_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * Call at boot: Chrome can fire `beforeinstallprompt` before React mounts.
 * The event is kept but not `preventDefault()`ed, so Chrome's own install UI
 * (the Android mini-infobar) stays as it is.
 */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
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
  // An event can open its dialog once. After a dismissal Chrome fires a fresh one.
  deferredPrompt = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
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
    // Storage full or blocked: the offer can show again, which is harmless.
  }
}
