import { useCallback, useState } from 'react';

const FILTER_RAIL_KEY = 'gridfinity-community-filter-rail-v1';

const COLLAPSED = 'collapsed';

/** Open on a first visit: an undiscovered filter rail is no filter rail. */
export function loadRailOpen(): boolean {
  try {
    return localStorage.getItem(FILTER_RAIL_KEY) !== COLLAPSED;
  } catch {
    return true;
  }
}

export function saveRailOpen(open: boolean): void {
  try {
    localStorage.setItem(FILTER_RAIL_KEY, open ? 'open' : COLLAPSED);
  } catch {
    // A full or blocked store costs the preference, never the session.
  }
}

export interface FilterPanelState {
  readonly open: boolean;
  readonly toggle: () => void;
  readonly close: () => void;
}

/**
 * Open state for the filter surface, which is one control with two lifetimes:
 * the desktop rail is a persisted layout preference, the mobile in-place view
 * is a transient navigation state that should never come back on its own.
 *
 * They are tracked separately so resizing across the breakpoint mid-session
 * cannot leak one into the other.
 */
export function useFilterPanel(isMobile: boolean): FilterPanelState {
  const [railOpen, setRailOpen] = useState(loadRailOpen);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastIsMobile, setLastIsMobile] = useState(isMobile);

  // Leaving mobile ends the mobile view for good. Left standing, it would
  // reopen on the way back to mobile width and take the whole grid over
  // unprompted — a rail quietly reappearing is recoverable, a full-screen
  // takeover nobody asked for is not.
  //
  // Adjusted during render rather than in an effect: React re-runs this
  // component before committing, so the stale value never reaches the DOM and
  // no second render pass is queued.
  if (lastIsMobile !== isMobile) {
    setLastIsMobile(isMobile);
    if (!isMobile) setMobileOpen(false);
  }

  const toggle = useCallback(() => {
    if (isMobile) {
      setMobileOpen((prev) => !prev);
      return;
    }
    setRailOpen((prev) => {
      saveRailOpen(!prev);
      return !prev;
    });
  }, [isMobile]);

  const close = useCallback(() => {
    if (isMobile) {
      setMobileOpen(false);
      return;
    }
    setRailOpen(false);
    saveRailOpen(false);
  }, [isMobile]);

  return { open: isMobile ? mobileOpen : railOpen, toggle, close };
}
