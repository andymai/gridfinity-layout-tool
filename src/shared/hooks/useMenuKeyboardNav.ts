import {
  useCallback,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';

interface UseMenuKeyboardNavOptions {
  /** Whether the menu is currently rendered. Focus moves in on the false→true edge. */
  isOpen: boolean;
  /** The element carrying `role="menu"`. */
  menuRef: RefObject<HTMLElement | null>;
  /** Called on Escape. */
  onClose: () => void;
}

// menuitemcheckbox/menuitemradio are equally valid children of role="menu" —
// a menu carrying toggles (layer visibility, sort order) uses them, and
// matching only "menuitem" would leave those menus with nothing to traverse.
const ITEM_SELECTOR = ['[role="menuitem"]', '[role="menuitemcheckbox"]', '[role="menuitemradio"]']
  .map((role) => `${role}:not([disabled]):not([aria-disabled="true"])`)
  .join(',');

/**
 * The keyboard contract that `role="menu"` promises: focus lands on the first
 * item when the menu opens, Arrow keys traverse with wraparound, Home/End jump
 * to the ends, Escape closes.
 *
 * Declaring the role without this is worse than declaring nothing — assistive
 * tech announces navigation the menu does not implement, so the user follows
 * the announcement into a dead end (#3277).
 *
 * Items are discovered by DOM query rather than by registration, so a menu can
 * hold arbitrary content (inputs, swatches, headers) and still traverse only
 * its items.
 */
export function useMenuKeyboardNav({ isOpen, menuRef, onClose }: UseMenuKeyboardNavOptions) {
  useEffect(() => {
    if (!isOpen) return;
    // Menus that mount their content in the same commit need a frame before the
    // items exist to query.
    const frame = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, menuRef]);

  return useCallback(
    (e: ReactKeyboardEvent) => {
      const menu = menuRef.current;
      if (!menu) return;

      // A text field inside the menu owns its own caret keys.
      const target = e.target as HTMLElement | null;
      const editable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;
      if (editable && e.key !== 'Escape') return;

      const items = Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR));

      const move = (next: (current: number) => number) => {
        if (items.length === 0) return;
        e.preventDefault();
        items[next(items.indexOf(document.activeElement as HTMLElement))]?.focus();
      };

      switch (e.key) {
        case 'ArrowDown':
          move((i) => (i < items.length - 1 ? i + 1 : 0));
          break;
        case 'ArrowUp':
          move((i) => (i > 0 ? i - 1 : items.length - 1));
          break;
        case 'Home':
          move(() => 0);
          break;
        case 'End':
          move(() => items.length - 1);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [menuRef, onClose]
  );
}
