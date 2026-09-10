import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { useMenuKeyboardNav } from './useMenuKeyboardNav';

interface UseAnchoredMenuOptions {
  /** Runs on every close, whichever way it happens: toggle, click outside, Escape or an item. */
  onClose?: () => void;
}

/** Below this much room under the button the menu opens upward instead. */
const MIN_SPACE_BELOW_PX = 200;
const GAP_PX = 4;

/**
 * An overflow menu portaled next to its button. The position is fixed so the
 * menu escapes a modal's transform, and it is measured on open rather than
 * tracked, so a scroll while open leaves it where it was.
 */
export function useAnchoredMenu({ onClose }: UseAnchoredMenuOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const close = useCallback(() => {
    setIsOpen(false);
    onCloseRef.current?.();
  }, []);

  const onMenuKeyDown = useMenuKeyboardNav({ isOpen, menuRef, onClose: close });

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, close]);

  const toggle = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      if (isOpen) {
        close();
        return;
      }
      const button = menuButtonRef.current;
      if (button) {
        const rect = button.getBoundingClientRect();
        const openAbove = window.innerHeight - rect.bottom < MIN_SPACE_BELOW_PX;
        setMenuStyle({
          position: 'fixed',
          right: window.innerWidth - rect.right,
          ...(openAbove
            ? { bottom: window.innerHeight - rect.top + GAP_PX }
            : { top: rect.bottom + GAP_PX }),
        });
      }
      setIsOpen(true);
    },
    [isOpen, close]
  );

  const withClose = useCallback(
    (action: () => void) => (e: ReactMouseEvent) => {
      e.stopPropagation();
      action();
      close();
    },
    [close]
  );

  return { isOpen, menuStyle, menuButtonRef, menuRef, toggle, close, withClose, onMenuKeyDown };
}
