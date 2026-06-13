import { useEffect, useRef, useState, useCallback } from 'react';
import { useMobileStore } from '@/core/store';
import { IconButton, XIcon } from '@/design-system';
import { useResponsive } from '@/shared/hooks';
import { useTranslation } from '@/i18n';

/** Minimum velocity (px/ms) to dismiss regardless of distance */
const VELOCITY_DISMISS_THRESHOLD = 0.5;
/** Maximum rubber-band overshoot when dragging upward (px) */
const RUBBER_BAND_MAX = 20;
/** Rubber-band resistance factor (0-1, lower = more resistance) */
const RUBBER_BAND_FACTOR = 0.3;

interface BottomSheetProps {
  children: React.ReactNode;
  title: string;
}

/**
 * Bottom sheet container for mobile panels.
 * Features gesture dismiss (swipe down with velocity detection),
 * rubber-band overscroll, haptic feedback, and backdrop tap to close.
 */
export function BottomSheet({ children, title }: BottomSheetProps) {
  const t = useTranslation();
  const activeMobilePanel = useMobileStore((state) => state.activeMobilePanel);
  const closeMobilePanel = useMobileStore((state) => state.closeMobilePanel);
  const { viewportHeight } = useResponsive();

  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  // Track whether we're animating the dismiss (slide off-screen)
  const [isDismissing, setIsDismissing] = useState(false);
  const dragStartY = useRef(0);
  const dragYRef = useRef(0);

  // Velocity tracking: store last two move timestamps/positions
  const lastMoveRef = useRef<{ y: number; time: number } | null>(null);
  const velocityRef = useRef(0);

  // Adaptive dismiss threshold: 15% of viewport height, capped at 80px
  // Smaller screens get smaller thresholds for easier dismissal
  const dismissThreshold = Math.min(80, Math.round(viewportHeight * 0.15));

  const isOpen = activeMobilePanel !== null;

  // Handle swipe down to dismiss
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only track drags on the header area
    const headerEl = (e.target as HTMLElement).closest('[data-sheet-header]');
    if (!headerEl) return;

    setIsDragging(true);
    dragStartY.current = e.clientY;
    lastMoveRef.current = { y: e.clientY, time: performance.now() };
    velocityRef.current = 0;
    // Capture on the header element to ensure consistent drag tracking
    headerEl.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;

      const deltaY = e.clientY - dragStartY.current;

      // Track velocity from the last move event
      const now = performance.now();
      if (lastMoveRef.current) {
        const dt = now - lastMoveRef.current.time;
        if (dt > 0) {
          velocityRef.current = (e.clientY - lastMoveRef.current.y) / dt;
        }
      }
      lastMoveRef.current = { y: e.clientY, time: now };

      // Rubber-band effect when dragging upward:
      // Apply diminishing resistance so the sheet feels elastic
      let clamped: number;
      if (deltaY < 0) {
        clamped = -(
          RUBBER_BAND_MAX *
          (1 - Math.exp((deltaY * RUBBER_BAND_FACTOR) / RUBBER_BAND_MAX))
        );
      } else {
        clamped = deltaY;
      }

      dragYRef.current = clamped;
      setDragY(clamped);
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    const distance = dragYRef.current;
    const velocity = velocityRef.current;

    // Dismiss if: dragged past threshold OR fast downward flick
    const shouldDismiss =
      distance > dismissThreshold || (velocity > VELOCITY_DISMISS_THRESHOLD && distance > 10);

    if (shouldDismiss) {
      // Haptic feedback on dismiss
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- not available in all environments (e.g. jsdom)
      if (navigator.vibrate) {
        navigator.vibrate(15);
      }
      // Animate off-screen before closing
      setIsDismissing(true);
      setDragY(viewportHeight);
      // Wait for the slide-out animation to complete
      setTimeout(() => {
        closeMobilePanel();
        setIsDismissing(false);
        setDragY(0);
      }, 200);
    } else {
      // Snap back with spring animation
      dragYRef.current = 0;
      setDragY(0);
    }

    lastMoveRef.current = null;
    velocityRef.current = 0;
  }, [isDragging, dismissThreshold, closeMobilePanel, viewportHeight]);

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

  // Choose transition timing: instant during drag, spring-like snap-back/dismiss otherwise
  const transitionStyle = isDragging
    ? '0ms'
    : isDismissing
      ? '200ms'
      : '300ms cubic-bezier(0.25, 1, 0.5, 1)';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{
          backgroundColor: 'var(--overlay-medium)',
          opacity: isDragging ? 1 - Math.max(0, dragY) / 300 : isDismissing ? 0 : 1,
        }}
        onClick={closeMobilePanel}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed left-0 right-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-surface-secondary"
        style={{
          maxHeight: '85dvh',
          transform: `translateY(${dragY}px)`,
          transition: `transform ${transitionStyle}`,
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
            {dragY > dismissThreshold
              ? t('mobile.bottomSheet.releaseToClose')
              : t('mobile.bottomSheet.swipeToClose')}
          </div>

          {/* Title row */}
          <div className="w-full flex items-center justify-between px-4">
            <h2 className="text-base font-medium text-content">{title}</h2>
            <IconButton onClick={closeMobilePanel} aria-label={t('mobile.bottomSheet.closePanel')}>
              <XIcon />
            </IconButton>
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
