import { useEffect, useRef, useState, useCallback } from 'react';
import { useUIStore } from '@/core/store/ui';
import { useResponsive } from '@/shared/hooks';

interface BottomSheetProps {
  children: React.ReactNode;
  title: string;
}

/**
 * Bottom sheet container for mobile panels.
 * Features gesture dismiss (swipe down) and backdrop tap to close.
 */
export function BottomSheet({ children, title }: BottomSheetProps) {
  const activeMobilePanel = useUIStore((state) => state.activeMobilePanel);
  const closeMobilePanel = useUIStore((state) => state.closeMobilePanel);
  const { viewportHeight } = useResponsive();

  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragYRef = useRef(0);

  // Adaptive dismiss threshold: 15% of viewport height, capped at 80px
  // Smaller screens get smaller thresholds for easier dismissal
  const dismissThreshold = Math.min(80, Math.round(viewportHeight * 0.15));

  const isOpen = activeMobilePanel !== null;

  // Handle swipe down to dismiss
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only track drags on the header area
    const headerEl = (e.target as HTMLElement).closest('[data-sheet-header]') as HTMLElement | null;
    if (!headerEl) return;

    setIsDragging(true);
    dragStartY.current = e.clientY;
    // Capture on the header element to ensure consistent drag tracking
    if (headerEl.setPointerCapture) {
      headerEl.setPointerCapture(e.pointerId);
    }
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;

      const deltaY = e.clientY - dragStartY.current;
      // Only allow dragging down
      const clamped = Math.max(0, deltaY);
      dragYRef.current = clamped;
      setDragY(clamped);
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);
    // If dragged more than threshold, close the sheet
    if (dragYRef.current > dismissThreshold) {
      closeMobilePanel();
    }
    dragYRef.current = 0;
    setDragY(0);
  }, [isDragging, dismissThreshold, closeMobilePanel]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeMobilePanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeMobilePanel]);

  // Lock body scroll when open
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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{
          backgroundColor: 'var(--overlay-medium)',
          opacity: isDragging ? 1 - dragY / 300 : 1,
        }}
        onClick={closeMobilePanel}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed left-0 right-0 bottom-0 z-50 flex flex-col rounded-t-2xl transition-transform duration-200 bg-surface-secondary"
        style={{
          maxHeight: '85dvh',
          transform: `translateY(${dragY}px)`,
          transitionDuration: isDragging ? '0ms' : '200ms',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Drag handle and header */}
        <div
          data-sheet-header
          className="flex flex-col items-center pt-3 pb-3 cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
        >
          {/* Drag indicator - larger and more prominent */}
          <div
            className="w-12 h-1.5 rounded-full mb-2 transition-all duration-150"
            style={{
              backgroundColor: isDragging ? 'var(--color-primary)' : 'var(--text-disabled)',
              transform: isDragging ? 'scaleX(1.2)' : 'scaleX(1)',
            }}
          />
          {/* Swipe hint - shows during drag */}
          <div
            className="text-xs mb-2 transition-opacity duration-150 text-content-disabled"
            style={{
              opacity: isDragging ? 1 : 0,
              height: isDragging ? 'auto' : 0,
            }}
          >
            {dragY > 80 ? 'Release to close' : 'Swipe down to close'}
          </div>

          {/* Title row */}
          <div className="w-full flex items-center justify-between px-4">
            <h2 className="text-base font-medium text-content">{title}</h2>
            <button
              onClick={closeMobilePanel}
              className="btn btn-ghost btn-icon"
              aria-label="Close panel"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto px-4"
          style={{
            overscrollBehavior: 'contain',
            paddingBottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
