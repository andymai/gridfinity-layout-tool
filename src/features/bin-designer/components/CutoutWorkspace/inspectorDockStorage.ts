/** Persist and load the cutout inspector dock width + collapsed state. */

const WIDTH_KEY = 'gridfinity-cutout-inspector-width';
const COLLAPSED_KEY = 'gridfinity-cutout-inspector-collapsed';

export const INSPECTOR_MIN_WIDTH = 220;
export const INSPECTOR_MAX_WIDTH = 420;
export const INSPECTOR_DEFAULT_WIDTH = 288;

export function loadInspectorWidth(): number {
  try {
    const stored = localStorage.getItem(WIDTH_KEY);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= INSPECTOR_MIN_WIDTH && parsed <= INSPECTOR_MAX_WIDTH) {
        return parsed;
      }
    }
  } catch {
    // best-effort
  }
  return INSPECTOR_DEFAULT_WIDTH;
}

export function saveInspectorWidth(width: number): void {
  try {
    localStorage.setItem(WIDTH_KEY, String(Math.round(width)));
  } catch {
    // best-effort
  }
}

export function loadInspectorCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveInspectorCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // best-effort
  }
}
