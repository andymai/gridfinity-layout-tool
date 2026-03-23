/**
 * Browser privacy signal detection.
 *
 * Separated from init.ts to avoid circular dependencies:
 * settings.normalize → init → settings store → settings.normalize.
 * This module has zero store imports, so it's safe to import anywhere.
 */

/**
 * Check if the browser signals a tracking opt-out via
 * Global Privacy Control (modern, legally enforceable) or
 * legacy Do Not Track (still in Chrome/Edge).
 */
export function isTrackingOptOut(): boolean {
  if (typeof navigator === 'undefined') return false;

  // GPC — modern signal, boolean, legally enforceable in CA/CO/CT/NJ
  if (navigator.globalPrivacyControl === true) return true;

  // Legacy DNT — returns string "1", "0", or null
  if (navigator.doNotTrack === '1') return true;

  return false;
}
