/**
 * Width + collapsed persistence for the Bento dock. Sibling of the cutout
 * workspace's `inspectorDockStorage` with bento-scoped keys — the two docks
 * are sized independently. Best-effort: storage failures fall back to
 * defaults silently.
 */

const WIDTH_KEY = 'gridfinity-bento-dock-width';
const COLLAPSED_KEY = 'gridfinity-bento-dock-collapsed';

export const BENTO_DOCK_MIN_WIDTH = 220;
export const BENTO_DOCK_MAX_WIDTH = 420;
export const BENTO_DOCK_DEFAULT_WIDTH = 288;

export function loadBentoDockWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_KEY);
    if (raw === null) return BENTO_DOCK_DEFAULT_WIDTH;
    const parsed = Number(raw);
    if (
      !Number.isFinite(parsed) ||
      parsed < BENTO_DOCK_MIN_WIDTH ||
      parsed > BENTO_DOCK_MAX_WIDTH
    ) {
      return BENTO_DOCK_DEFAULT_WIDTH;
    }
    return parsed;
  } catch {
    return BENTO_DOCK_DEFAULT_WIDTH;
  }
}

export function saveBentoDockWidth(width: number): void {
  try {
    localStorage.setItem(WIDTH_KEY, String(Math.round(width)));
  } catch {
    // best-effort
  }
}

export function loadBentoDockCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveBentoDockCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // best-effort
  }
}
