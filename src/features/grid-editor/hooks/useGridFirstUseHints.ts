import { useState, useEffect, useRef } from 'react';
import { useToastStore } from '@/core/store/toast';
import type { PaintSize } from '@/core/store/interaction';
import { useSettingsStore } from '@/core/store/settings';
import { useTranslation } from '@/i18n';

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

  const t = useTranslation();
  const addToast = useToastStore((state) => state.addToast);

  // Track if paint mode hint should pulse (first use)
  const [shouldPulsePaintHint, setShouldPulsePaintHint] = useState(false);

  // Refs to track timeout IDs for cleanup
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show first-time toast when paint mode is activated
  useEffect(() => {
    // Clear any pending timeouts before setting new ones
    if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    if (stopPulseTimeoutRef.current) clearTimeout(stopPulseTimeoutRef.current);
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);

    if (paintSize) {
      const { settings, updateSetting } = useSettingsStore.getState();
      if (!settings.dismissedHints.includes('paint-mode')) {
        addToast(t('toast.paintModeHint'), 'info');
        updateSetting('dismissedHints', [...settings.dismissedHints, 'paint-mode']);
        // Defer state update to avoid cascading renders
        pulseTimeoutRef.current = setTimeout(() => {
          setShouldPulsePaintHint(true);
          // Stop pulsing after 3 seconds
          stopPulseTimeoutRef.current = setTimeout(() => setShouldPulsePaintHint(false), 3000);
        }, 0);
      }
    } else {
      // Defer state update to avoid cascading renders
      resetTimeoutRef.current = setTimeout(() => setShouldPulsePaintHint(false), 0);
    }

    // Cleanup timeouts on unmount or dependency change
    return () => {
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
      if (stopPulseTimeoutRef.current) clearTimeout(stopPulseTimeoutRef.current);
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, [paintSize, addToast, t]);

  return {
    shouldPulsePaintHint,
  };
}
