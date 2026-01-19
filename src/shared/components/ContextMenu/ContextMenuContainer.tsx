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
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-overlay-light"
        onClick={onClose}
      />

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
      >
        {children}
      </div>
    </>
  );
}
