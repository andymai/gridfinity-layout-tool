/**
 * Keyboard shortcuts for the standalone baseplate page.
 *
 * Supported shortcuts:
 * - X / x: toggle X-ray
 * - P / p: toggle projection (perspective ↔ orthographic)
 */

import { useEffect } from 'react';
import { SHORTCUTS } from '@/core/constants';

interface UseBaseplateKeyboardOptions {
  onToggleXray: () => void;
  onToggleProjection: () => void;
}

export function useBaseplateKeyboard({
  onToggleXray,
  onToggleProjection,
}: UseBaseplateKeyboardOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === SHORTCUTS.TOGGLE_XRAY || e.key === SHORTCUTS.TOGGLE_XRAY.toUpperCase()) {
        e.preventDefault();
        onToggleXray();
        return;
      }
      if (
        e.key === SHORTCUTS.TOGGLE_PROJECTION ||
        e.key === SHORTCUTS.TOGGLE_PROJECTION.toUpperCase()
      ) {
        e.preventDefault();
        onToggleProjection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleXray, onToggleProjection]);
}
