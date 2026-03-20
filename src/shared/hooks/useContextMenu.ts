import { useEffect, useRef, useState } from 'react';

/**
 * Hook return type for context menu management
 */
export interface UseContextMenuReturn {
  /** Whether the menu is currently visible */
  isOpen: boolean;
  /** Adjusted position that keeps menu within viewport bounds */
  position: { x: number; y: number };
  /** Show the context menu at the given position */
  show: (position: { x: number; y: number }) => void;
  /** Hide the context menu */
  hide: () => void;
  /** Ref for the menu container element */
  menuRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Custom hook for managing context menu lifecycle, positioning, and interactions.
 *
 * Handles:
 * - Menu visibility state
 * - Position adjustment to keep menu within viewport bounds
 * - Click-outside detection (with delay to prevent immediate close)
 * - Escape key handling
 * - Automatic cleanup on unmount
 *
 * @param options Configuration options
 * @param options.menuWidth Estimated menu width in pixels (default: 200)
 * @param options.menuHeight Estimated menu height in pixels (default: 250)
 * @returns Context menu state and controls
 *
 * @example
 * const { isOpen, position, show, hide, menuRef } = useContextMenu();
 *
 * const handleRightClick = (e: React.MouseEvent) => {
 *   e.preventDefault();
 *   show({ x: e.clientX, y: e.clientY });
 * };
 *
 * return (
 *   <div onContextMenu={handleRightClick}>
 *     {isOpen && (
 *       <ContextMenuContainer
 *         isOpen={isOpen}
 *         position={position}
 *         onClose={hide}
 *         menuRef={menuRef}
 *       >
 *         <ContextMenuItem label="Action" onClick={hide} />
 *       </ContextMenuContainer>
 *     )}
 *   </div>
 * );
 */
export function useContextMenu(): UseContextMenuReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [rawPosition, setRawPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // Position is now calculated by the calling component
  const adjustedPosition = rawPosition;

  const show = (position: { x: number; y: number }) => {
    setRawPosition(position);
    setIsOpen(true);
  };

  const hide = () => {
    setIsOpen(false);
  };

  // Close on outside click - use pointerdown for unified mouse/touch handling
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        hide();
      }
    };

    // Use timeout to avoid immediate close from the triggering event
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return {
    isOpen,
    position: adjustedPosition,
    show,
    hide,
    menuRef,
  };
}
