/**
 * Best-effort persistence for a SidePanel's width and collapsed state.
 * Keys are `${prefix}-width` / `${prefix}-collapsed`, matching the legacy
 * cutout inspector keys when the prefix is `gridfinity-cutout-inspector`,
 * so adopting panels keep users' saved layouts.
 */

interface WidthBounds {
  readonly min: number;
  readonly max: number;
  readonly fallback: number;
}

export function loadPanelWidth(prefix: string, bounds: WidthBounds): number {
  try {
    const stored = localStorage.getItem(`${prefix}-width`);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= bounds.min && parsed <= bounds.max) {
        return parsed;
      }
    }
  } catch {
    // best-effort
  }
  return bounds.fallback;
}

export function savePanelWidth(prefix: string, width: number): void {
  try {
    localStorage.setItem(`${prefix}-width`, String(Math.round(width)));
  } catch {
    // best-effort
  }
}

export function loadPanelCollapsed(prefix: string, fallback = false): boolean {
  try {
    const stored = localStorage.getItem(`${prefix}-collapsed`);
    return stored === null ? fallback : stored === '1';
  } catch {
    return fallback;
  }
}

export function savePanelCollapsed(prefix: string, collapsed: boolean): void {
  try {
    localStorage.setItem(`${prefix}-collapsed`, collapsed ? '1' : '0');
  } catch {
    // best-effort
  }
}
