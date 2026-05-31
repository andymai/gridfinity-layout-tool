import { generateUUID } from './uuid';

const DEVICE_ID_KEY = 'gridfinity-device-id';

/**
 * Stable per-install identifier used to seed a personal-feeling avatar for
 * local-only (signed-out) users. Persisted once to localStorage so the same
 * device always renders the same identicon.
 */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = generateUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // localStorage blocked (private mode, restricted iframe) — fall back to an
    // ephemeral id. Callers memoize per mount, so the avatar stays stable on screen.
    return generateUUID();
  }
}
