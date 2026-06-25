/** Persist and load the right inspector's collapsed state (mirrors the cutout
 *  inspector dock's localStorage pattern; the store has no persist middleware). */

const COLLAPSED_KEY = 'gridfinity-right-inspector-collapsed';

/** Returns the stored collapsed flag, or null when the user hasn't set one yet
 *  (so the shell can pick a width-based default on first run). */
export function loadRightInspectorCollapsed(): boolean | null {
  try {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    return stored === null ? null : stored === '1';
  } catch {
    return null;
  }
}

export function saveRightInspectorCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // best-effort
  }
}
