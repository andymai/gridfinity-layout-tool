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

const STEPS: Record<string, ((current: number, count: number) => number) | undefined> = {
  ArrowDown: (current, count) => (current < count - 1 ? current + 1 : 0),
  ArrowUp: (current, count) => (current > 0 ? current - 1 : count - 1),
  Home: () => 0,
  End: (_current, count) => count - 1,
};

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

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      const step = STEPS[e.key];
      // Every other key — Tab, Shift, letters — leaves before the DOM query.
      if (!step) return;

      // A text field inside the menu owns its own caret keys.
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true
      ) {
        return;
      }

      const items = Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
      if (items.length === 0) return;

      e.preventDefault();
      items[step(items.indexOf(document.activeElement as HTMLElement), items.length)]?.focus();
    },
    [menuRef, onClose]
  );
}
