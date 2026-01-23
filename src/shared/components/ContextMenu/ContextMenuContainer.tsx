import { useEffect, useCallback } from 'react';
import type { RefObject } from 'react';

interface ContextMenuContainerProps {
  /** Whether the menu is visible */
  isOpen: boolean;
  /** Position for the menu (already adjusted for viewport bounds) */
  position: { x: number; y: number };
  /** Callback when menu should close */
  onClose: () => void;
  /** Ref for the menu container element */
  menuRef: RefObject<HTMLDivElement | null>;
  /** Menu content */
  children: React.ReactNode;
}

/**
 * Container component for context menus.
 * Provides consistent backdrop, positioning, styling, and animations.
 * Supports keyboard navigation: Arrow Up/Down to move between items,
 * Escape to close, Home/End for first/last item.
 *
 * @example
 * <ContextMenuContainer
 *   isOpen={isOpen}
 *   position={position}
 *   onClose={hide}
 *   menuRef={menuRef}
 * >
 *   <ContextMenuItem label="Delete" onClick={handleDelete} />
 * </ContextMenuContainer>
 */
export function ContextMenuContainer({
  isOpen,
  position,
  onClose,
  menuRef,
  children,
}: ContextMenuContainerProps) {
  // Focus first menu item when menu opens
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const firstItem = menuRef.current.querySelector<HTMLElement>(
      '[role="menuitem"]:not([disabled])'
    );
    firstItem?.focus();
  }, [isOpen, menuRef]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!menuRef.current) return;

      const items = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')
      );
      if (items.length === 0) return;

      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          items[nextIndex].focus();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          items[prevIndex].focus();
          break;
        }
        case 'Home': {
          e.preventDefault();
          items[0].focus();
          break;
        }
        case 'End': {
          e.preventDefault();
          items[items.length - 1].focus();
          break;
        }
        case 'Escape': {
          e.preventDefault();
          onClose();
          break;
        }
      }
    },
    [menuRef, onClose]
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-overlay-light" onClick={onClose} />

      {/* Menu */}
      <div
        ref={menuRef}
        role="menu"
        aria-label="Context menu"
        className="fixed z-50 rounded-xl overflow-hidden shadow-xl bg-surface-elevated border border-stroke-subtle animate-fade-in"
        style={{
          left: position.x,
          top: position.y,
          minWidth: '180px',
        }}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </>
  );
}
