import { useState, useEffect } from 'react';
import { useToastStore } from '../store/toast';
import type { PaintSize } from '../store/interaction';

/**
 * Grid First-Use Hints Hook
 *
 * Manages localStorage-based first-use hint tracking for:
 * - Paint mode activation (shows toast + pulse animation)
 *
 * Extracted from Grid/index.tsx as part of component decomposition.
 */

export interface GridFirstUseHintsState {
  /** Whether paint mode hint should pulse (first use) */
  shouldPulsePaintHint: boolean;
}

export interface UseGridFirstUseHintsOptions {
  /** Current paint size (null when not in paint mode) */
  paintSize: PaintSize | null;
}

export function useGridFirstUseHints(options: UseGridFirstUseHintsOptions): GridFirstUseHintsState {
  const { paintSize } = options;

  const addToast = useToastStore((state) => state.addToast);

  // Track if paint mode hint should pulse (first use)
  const [shouldPulsePaintHint, setShouldPulsePaintHint] = useState(false);

  // Show first-time toast when paint mode is activated
  useEffect(() => {
    if (paintSize) {
      const hintShown = localStorage.getItem('gridfinity-paint-mode-hint-shown');
      if (!hintShown) {
        addToast('Paint Mode: Drag to fill area, press Esc or click × to exit', 'info');
        localStorage.setItem('gridfinity-paint-mode-hint-shown', 'true');
        // Defer state update to avoid cascading renders
        setTimeout(() => {
          setShouldPulsePaintHint(true);
          // Stop pulsing after 3 seconds
          setTimeout(() => setShouldPulsePaintHint(false), 3000);
        }, 0);
      }
    } else {
      // Defer state update to avoid cascading renders
      setTimeout(() => setShouldPulsePaintHint(false), 0);
    }
  }, [paintSize, addToast]);

  return {
    shouldPulsePaintHint,
  };
}
