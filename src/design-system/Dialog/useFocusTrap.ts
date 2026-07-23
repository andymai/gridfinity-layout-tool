import { useEffect, useRef } from 'react';

// Focus Trap Hook

export type DialogInitialFocus = 'first' | 'container' | React.RefObject<HTMLElement | null>;

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Traps Tab focus inside `containerRef` while active and applies initial
 * focus on activation. Listens on the container (not document) so nested
 * dialogs and contained keyboard events don't interfere with each other.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isActive: boolean,
  initialFocus: DialogInitialFocus = 'first'
): void {
  const initialFocusRef = useRef(initialFocus);

  useEffect(() => {
    initialFocusRef.current = initialFocus;
  }, [initialFocus]);

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    const getFocusableElements = () => {
      return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const target = initialFocusRef.current;
    if (target === 'container') {
      container.focus();
    } else if (target !== 'first' && target.current) {
      target.current.focus();
    } else {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        container.focus();
      }
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, isActive]);
}
