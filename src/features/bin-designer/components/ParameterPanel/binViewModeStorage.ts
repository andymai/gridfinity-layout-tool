/** Persist the bin designer's panel view mode across sessions (best-effort). */

export type BinPanelViewMode = 'scroll' | 'rail';

const VIEW_MODE_KEY = 'gridfinity-designer-view-mode-v1';

/** The single long scroll is the default; the compact rail is opt-in. */
export function loadViewMode(): BinPanelViewMode {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === 'rail' ? 'rail' : 'scroll';
  } catch {
    return 'scroll';
  }
}

export function saveViewMode(mode: BinPanelViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // best-effort
  }
}
