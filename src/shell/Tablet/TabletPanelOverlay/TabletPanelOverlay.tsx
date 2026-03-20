import { useEffect, type ReactNode } from 'react';

interface TabletPanelOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  side: 'left' | 'right';
  children: ReactNode;
}

/**
 * Overlay wrapper for tablet panel mode.
 * Slides in from specified side with backdrop.
 */
export function TabletPanelOverlay({ isOpen, onClose, side, children }: TabletPanelOverlayProps) {
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const translateX =
    side === 'left'
      ? isOpen
        ? 'translateX(0)'
        : 'translateX(-100%)'
      : isOpen
        ? 'translateX(0)'
        : 'translateX(100%)';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          backgroundColor: 'var(--overlay-medium)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel container */}
      <div
        className="fixed top-0 bottom-0 z-50 transition-transform duration-300 ease-out"
        style={{
          [side]: 0,
          transform: translateX,
          maxWidth: '85vw',
        }}
      >
        {children}
      </div>
    </>
  );
}
