import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from '@/i18n';
import { useMenuKeyboardNav } from '@/shared/hooks/useMenuKeyboardNav';

/** Margin from viewport edges (px) */
const VIEWPORT_MARGIN = 8;

interface ContextMenuContainerProps {
  /** Whether the menu is visible */
  isOpen: boolean;
  /** Position for the menu */
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
 * Automatically clamps position to keep the menu within viewport bounds.
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
  const t = useTranslation();

  // Measure menu after render and clamp position to viewport bounds.
  // Direct DOM mutation in useLayoutEffect avoids a double-render cycle
  // and runs before the browser paints, preventing a flash at the unclamped position.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!isOpen || !menu) return;

    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = position.x;
    let y = position.y;

    // Clamp right edge
    if (x + rect.width > vw - VIEWPORT_MARGIN) {
      x = Math.max(VIEWPORT_MARGIN, vw - rect.width - VIEWPORT_MARGIN);
    }
    // Clamp bottom edge
    if (y + rect.height > vh - VIEWPORT_MARGIN) {
      y = Math.max(VIEWPORT_MARGIN, vh - rect.height - VIEWPORT_MARGIN);
    }
    // Clamp left/top edges
    x = Math.max(VIEWPORT_MARGIN, x);
    y = Math.max(VIEWPORT_MARGIN, y);

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }, [isOpen, position, menuRef]);

  const handleKeyDown = useMenuKeyboardNav({ isOpen, menuRef, onClose });

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-overlay-light" onClick={onClose} aria-hidden="true" />

      {/* Menu */}
      <div
        ref={menuRef}
        role="menu"
        tabIndex={0}
        aria-label={t('contextMenu.contextMenu')}
        className="fixed z-50 rounded-xl overflow-hidden shadow-xl bg-surface-elevated border border-stroke-subtle animate-fade-in"
        style={{
          left: position.x,
          top: position.y,
          minWidth: '180px',
          maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
          maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
          overflowY: 'auto',
        }}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </>
  );
}
