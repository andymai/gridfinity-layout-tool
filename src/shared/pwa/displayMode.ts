export type DisplayMode =
  'window-controls-overlay' | 'standalone' | 'minimal-ui' | 'fullscreen' | 'browser';

const MEDIA_MODES = ['window-controls-overlay', 'standalone', 'minimal-ui', 'fullscreen'] as const;

function queryFor(mode: (typeof MEDIA_MODES)[number]): MediaQueryList {
  return window.matchMedia(`(display-mode: ${mode})`);
}

export function getDisplayMode(): DisplayMode {
  if (typeof window === 'undefined') return 'browser';
  // Older iOS home-screen apps set this flag but never match the media query.
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return 'standalone';
  if (typeof window.matchMedia !== 'function') return 'browser';
  return MEDIA_MODES.find((mode) => queryFor(mode).matches) ?? 'browser';
}

/**
 * `fullscreen` is excluded because a browser tab in F11 matches it too, so it
 * does not prove the app was launched from an install.
 */
export function isInstalledDisplayMode(mode: DisplayMode): boolean {
  return mode === 'standalone' || mode === 'window-controls-overlay' || mode === 'minimal-ui';
}

/**
 * Chrome on desktop moves the current tab into the new app window when the
 * user installs, so the mode can change without a reload.
 */
export function onDisplayModeChange(listener: (mode: DisplayMode) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }
  let last = getDisplayMode();
  const handleChange = (): void => {
    const next = getDisplayMode();
    if (next === last) return;
    last = next;
    listener(next);
  };
  const queries = MEDIA_MODES.map(queryFor);
  for (const query of queries) query.addEventListener('change', handleChange);
  return () => {
    for (const query of queries) query.removeEventListener('change', handleChange);
  };
}
