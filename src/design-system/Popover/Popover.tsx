import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

export interface PopoverProps {
  /** Reference to the element to anchor against */
  anchorRef: RefObject<HTMLElement | null>;
  /** Whether the popover is visible */
  isOpen: boolean;
  /** Called when the popover should close (click outside, Escape) */
  onClose: () => void;
  /** Where to place the popover relative to the anchor */
  placement?: Placement;
  /** Gap between anchor and popover in pixels */
  offset?: number;
  /** Popover content */
  children: ReactNode;
  /** Additional class names for the popover container */
  className?: string;
}

/**
 * A portal-based popover that anchors to a reference element.
 * Handles positioning, viewport boundary adjustment, click-outside, and Escape to close.
 */
export function Popover({
  anchorRef,
  isOpen,
  onClose,
  placement = 'bottom-start',
  offset: gap = 6,
  children,
  className = '',
}: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Position the popover relative to the anchor
  useEffect(() => {
    if (!isOpen || !anchorRef.current) return;

    const updatePosition = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const popover = popoverRef.current?.getBoundingClientRect();
      if (!anchor) return;

      const popWidth = popover?.width ?? 0;
      const popHeight = popover?.height ?? 0;
      const padding = 8;

      let top: number;
      let left: number;

      // Vertical placement
      const placeBelow = placement.startsWith('bottom');
      if (placeBelow) {
        top = anchor.bottom + gap;
        // Flip to top if not enough space below
        if (
          top + popHeight > window.innerHeight - padding &&
          anchor.top - popHeight - gap > padding
        ) {
          top = anchor.top - popHeight - gap;
        }
      } else {
        top = anchor.top - popHeight - gap;
        // Flip to bottom if not enough space above
        if (top < padding && anchor.bottom + popHeight + gap < window.innerHeight - padding) {
          top = anchor.bottom + gap;
        }
      }

      // Horizontal placement
      const alignStart = placement.endsWith('start');
      if (alignStart) {
        left = anchor.left;
      } else {
        left = anchor.right - popWidth;
      }

      // Clamp within viewport
      left = Math.max(padding, Math.min(left, window.innerWidth - popWidth - padding));
      top = Math.max(padding, Math.min(top, window.innerHeight - popHeight - padding));

      setPosition({ top, left });
    };

    updatePosition();

    // Re-position on scroll or resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, anchorRef, placement, gap]);

  // Close on click outside or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, anchorRef, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      className={`fixed z-50 bg-surface-elevated border border-stroke-subtle rounded-xl shadow-xl animate-scale-in ${className}`}
      style={{ top: position.top, left: position.left }}
    >
      {children}
    </div>,
    document.body
  );
}
