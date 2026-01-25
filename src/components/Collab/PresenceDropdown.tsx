/**
 * Dropdown popover for full participant list.
 *
 * Positioned below the trigger element using fixed positioning.
 * Follows the ShareButton popover pattern for consistent UX.
 */

import { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react';
import type { Participant, ConnectionStatus } from '@/hooks/usePresence';
import { PresenceAvatarList } from './PresenceAvatarList';
import { ConnectionIndicator } from './ConnectionIndicator';
import { useTranslation } from '@/i18n';

/** Minimum distance from viewport edge */
const VIEWPORT_PADDING = 16;
/** Popover width in pixels */
const POPOVER_WIDTH = 240;

interface PresenceDropdownProps {
  /** List of participants */
  participants: Participant[];
  /** Current connection status */
  status: ConnectionStatus;
  /** Reference to the trigger element for positioning */
  triggerRef: React.RefObject<HTMLElement | null>;
  /** Callback when dropdown should close */
  onClose: () => void;
}

/**
 * Renders a dropdown showing the full participant list.
 */
export function PresenceDropdown({
  participants,
  status,
  triggerRef,
  onClose,
}: PresenceDropdownProps) {
  const t = useTranslation();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  // Calculate position with viewport boundary checking
  const calculatePosition = useCallback((): { top: number; right: number } | null => {
    if (!triggerRef.current) return null;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = rect.bottom + 8;
    let right = viewportWidth - rect.right;

    // Check if popover would overflow right edge
    if (right < VIEWPORT_PADDING) {
      right = VIEWPORT_PADDING;
    }

    // Check if popover would overflow left edge
    const leftEdge = viewportWidth - right - POPOVER_WIDTH;
    if (leftEdge < VIEWPORT_PADDING) {
      right = viewportWidth - POPOVER_WIDTH - VIEWPORT_PADDING;
    }

    // Check if popover would overflow bottom (estimate height ~200px)
    const estimatedHeight = 200;
    if (top + estimatedHeight > viewportHeight - VIEWPORT_PADDING) {
      top = rect.top - estimatedHeight - 8;
      if (top < VIEWPORT_PADDING) {
        top = VIEWPORT_PADDING;
      }
    }

    return { top, right };
  }, [triggerRef]);

  // Calculate position on mount (useLayoutEffect for synchronous DOM measurement)
  // This is a legitimate use case: measuring DOM after render and updating position before paint
  useLayoutEffect(() => {
    const newPosition = calculatePosition();
    if (newPosition) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM measurement requires setState in useLayoutEffect
      setPosition(newPosition);
    }
  }, [calculatePosition]);

  // Handle resize events
  useEffect(() => {
    const handleResize = () => {
      const updated = calculatePosition();
      if (updated) {
        setPosition(updated);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculatePosition]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsidePopover = popoverRef.current?.contains(target);
      const isInsideTrigger = triggerRef.current?.contains(target);

      if (!isInsidePopover && !isInsideTrigger) {
        onClose();
      }
    };

    // Add listener on next frame to avoid catching the opening click
    const frameId = requestAnimationFrame(() => {
      document.addEventListener('click', handleClickOutside);
    });

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose, triggerRef]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const popoverStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        top: position.top,
        right: position.right,
        zIndex: 50,
        width: POPOVER_WIDTH,
      }
    : {
        position: 'fixed',
        top: 60,
        right: VIEWPORT_PADDING,
        zIndex: 50,
        width: POPOVER_WIDTH,
      };

  return (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="bg-surface-elevated border border-stroke rounded-lg shadow-lg overflow-hidden"
      role="dialog"
      aria-label={t('collab.participants')}
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-stroke-subtle">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-content">
            {t('collab.participantCount', { count: participants.length })}
          </span>
          <ConnectionIndicator status={status} size="sm" />
        </div>
        <button
          onClick={onClose}
          className="text-content-tertiary hover:text-content transition-colors p-1 -m-1"
          aria-label={t('common.close')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Participant list */}
      <div className="max-h-64 overflow-y-auto p-2">
        <PresenceAvatarList participants={participants} />
      </div>
    </div>
  );
}
