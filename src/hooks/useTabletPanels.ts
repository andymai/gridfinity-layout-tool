import { useEffect, useRef } from 'react';
import { useUIStore } from '../store/ui';

export interface TabletPanelsState {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  openLeftPanel: () => void;
  closeLeftPanel: () => void;
  openRightPanel: () => void;
  closeRightPanel: () => void;
}

/**
 * Manages tablet panel state with auto-collapse on tablet mode entry.
 *
 * In tablet mode, panels are overlays. This hook:
 * - Tracks open/closed state (inverted from store's "collapsed" state)
 * - Auto-collapses both panels when entering tablet mode
 * - Provides semantic open/close actions
 *
 * @param isTablet - Whether device is in tablet mode (768-899px)
 * @returns Panel state and control actions
 */
export function useTabletPanels(isTablet: boolean): TabletPanelsState {
  // Read collapsed state from store (collapsed=true means hidden overlay)
  const leftPanelCollapsed = useUIStore(state => state.leftPanelCollapsed);
  const rightPanelCollapsed = useUIStore(state => state.rightPanelCollapsed);
  const toggleLeftPanel = useUIStore(state => state.toggleLeftPanel);
  const toggleRightPanel = useUIStore(state => state.toggleRightPanel);

  // Track previous tablet state to detect mode entry
  const wasTabletRef = useRef(isTablet);

  // Auto-collapse panels when entering tablet mode
  useEffect(() => {
    const justEnteredTablet = isTablet && !wasTabletRef.current;
    wasTabletRef.current = isTablet;

    if (!isTablet) return;

    // When entering tablet mode, collapse both panels
    if (justEnteredTablet) {
      if (!leftPanelCollapsed) toggleLeftPanel();
      if (!rightPanelCollapsed) toggleRightPanel();
    }
  }, [isTablet, leftPanelCollapsed, rightPanelCollapsed, toggleLeftPanel, toggleRightPanel]);

  // Compute open state (inverted from collapsed)
  const leftPanelOpen = isTablet && !leftPanelCollapsed;
  const rightPanelOpen = isTablet && !rightPanelCollapsed;

  // Provide semantic actions (only toggle if needed)
  const openLeftPanel = () => {
    if (leftPanelCollapsed) toggleLeftPanel();
  };

  const closeLeftPanel = () => {
    if (!leftPanelCollapsed) toggleLeftPanel();
  };

  const openRightPanel = () => {
    if (rightPanelCollapsed) toggleRightPanel();
  };

  const closeRightPanel = () => {
    if (!rightPanelCollapsed) toggleRightPanel();
  };

  return {
    leftPanelOpen,
    rightPanelOpen,
    openLeftPanel,
    closeLeftPanel,
    openRightPanel,
    closeRightPanel,
  };
}
