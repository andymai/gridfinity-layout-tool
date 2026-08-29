/**
 * Formats a key sequence for visible shortcut hints, resolving the `Mod`
 * placeholder per platform: `['Mod','Z']` → `⌘Z` on macOS, `Ctrl+Z` elsewhere.
 * The app-wide convention for shortcut display — pair with a Kbd chip.
 */

const MAC_SYMBOLS: Record<string, string> = {
  Mod: '⌘',
  Cmd: '⌘',
  Meta: '⌘',
  Ctrl: '⌃',
  Alt: '⌥',
  Option: '⌥',
  Shift: '⇧',
};

const OTHER_NAMES: Record<string, string> = {
  Mod: 'Ctrl',
  Cmd: 'Ctrl',
  Meta: 'Ctrl',
  Option: 'Alt',
};

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

export function formatShortcut(
  keys: readonly string[],
  platform: 'mac' | 'other' = isMacPlatform() ? 'mac' : 'other'
): string {
  if (platform === 'mac') {
    return keys.map((k) => MAC_SYMBOLS[k] ?? k).join('');
  }
  return keys.map((k) => OTHER_NAMES[k] ?? k).join('+');
}
