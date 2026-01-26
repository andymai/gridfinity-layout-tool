/**
 * Popover component for displaying name suggestions.
 *
 * Shows:
 * - Primary suggestion prominently
 * - Expandable alternatives section
 * - Dismiss button
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n';
import { useNameSuggestions } from '../hooks';

interface SuggestionPopoverProps {
  /** Reference to the anchor element (name input button) */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Whether the popover is open */
  isOpen: boolean;
  /** Callback when popover should close */
  onClose: () => void;
}

/**
 * Popover for name suggestions, positioned below the anchor element.
 */
export function SuggestionPopover({ anchorRef, isOpen, onClose }: SuggestionPopoverProps) {
  const t = useTranslation();
  const popoverRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  // Track focused suggestion index: -1 = dismiss button, 0 = primary, 1+ = alternatives
  const [focusedIndex, setFocusedIndex] = useState(0);

  const {
    primarySuggestion,
    alternatives,
    showAlternatives,
    isLoadingMore,
    acceptPrimary,
    acceptAlternative,
    dismiss,
    toggleAlternatives,
  } = useNameSuggestions();

  // Total number of selectable suggestions (primary + visible alternatives)
  const totalSuggestions = 1 + (showAlternatives ? alternatives.length : 0);

  // Update position when anchor moves
  useEffect(() => {
    if (!isOpen || !anchorRef.current) return;

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) {
        const popoverWidth = 288; // w-72 = 18rem = 288px
        const popoverHeight = 200; // estimated height
        const padding = 8;

        // Calculate initial position
        let top = rect.bottom + padding;
        let left = rect.left;

        // Check right boundary
        if (left + popoverWidth > window.innerWidth - padding) {
          left = window.innerWidth - popoverWidth - padding;
        }

        // Check left boundary
        if (left < padding) {
          left = padding;
        }

        // Check bottom boundary - flip to above if needed
        if (top + popoverHeight > window.innerHeight - padding) {
          top = rect.top - popoverHeight - padding;
        }

        // Ensure top is not negative
        if (top < padding) {
          top = padding;
        }

        setPosition({ top, left });
      }
    };

    updatePosition();

    // Update on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, anchorRef]);

  // Focus primary suggestion when popover opens
  useEffect(() => {
    if (isOpen && primaryButtonRef.current) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        primaryButtonRef.current?.focus();
        setFocusedIndex(0);
      });
    }
  }, [isOpen]);

  // Accept the currently focused suggestion
  const acceptFocused = useCallback(() => {
    if (focusedIndex === 0) {
      acceptPrimary();
      onClose();
    } else if (showAlternatives && focusedIndex > 0 && focusedIndex <= alternatives.length) {
      acceptAlternative(focusedIndex - 1);
      onClose();
    }
  }, [focusedIndex, showAlternatives, alternatives.length, acceptPrimary, acceptAlternative, onClose]);

  // Close on click outside and keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    // Keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Arrow key navigation
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % totalSuggestions);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + totalSuggestions) % totalSuggestions);
      } else if (e.key === 'Enter' && !(e.target instanceof Element && e.target.closest('button'))) {
        // Only accept if not already on a button (button will handle its own click)
        e.preventDefault();
        acceptFocused();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, anchorRef, onClose, totalSuggestions, acceptFocused]);

  // Handle accepting primary and closing
  const handleAcceptPrimary = () => {
    acceptPrimary();
    onClose();
  };

  // Handle accepting alternative and closing
  const handleAcceptAlternative = (index: number) => {
    acceptAlternative(index);
    onClose();
  };

  // Handle dismiss and closing
  const handleDismiss = () => {
    dismiss();
    onClose();
  };

  if (!isOpen || !primarySuggestion) return null;

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('nameSuggestion.title')}
      className="fixed z-50 w-72 bg-surface-elevated border border-stroke rounded-lg shadow-lg"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-stroke">
        <span className="text-xs font-medium text-content-secondary uppercase tracking-wide">
          {t('nameSuggestion.title')}
        </span>
        <button
          onClick={handleDismiss}
          className="p-1 rounded text-content-tertiary hover:text-content hover:bg-surface transition-colors"
          aria-label={t('common.dismiss')}
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

      {/* Primary suggestion */}
      <div className="p-3">
        <button
          ref={primaryButtonRef}
          onClick={handleAcceptPrimary}
          onFocus={() => setFocusedIndex(0)}
          className={`w-full text-left p-3 rounded-lg border transition-colors group ${
            focusedIndex === 0
              ? 'bg-accent/20 border-accent/40 ring-2 ring-accent/30'
              : 'bg-accent/10 hover:bg-accent/20 border-accent/20'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-content truncate flex-1" title={primarySuggestion.name}>
              {primarySuggestion.name}
            </span>
            <span className={`text-xs text-accent transition-opacity shrink-0 ${focusedIndex === 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              {t('nameSuggestion.useThis')}
            </span>
          </div>
          <span className="text-xs text-content-secondary mt-1 block">
            {t(`nameSuggestion.source.${primarySuggestion.source}`)}
          </span>
        </button>
      </div>

      {/* Loading indicator for LLM suggestions */}
      {isLoadingMore && (
        <div className="px-3 pb-2 flex items-center gap-2 text-xs text-content-secondary">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {t('nameSuggestion.loadingMore')}
        </div>
      )}

      {/* Alternatives (expandable) */}
      {alternatives.length > 0 && (
        <div className="px-3 pb-3">
          <button
            onClick={toggleAlternatives}
            aria-expanded={showAlternatives}
            className="flex items-center gap-1 text-xs text-content-secondary hover:text-content transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showAlternatives ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {t('nameSuggestion.showAlternatives', { count: alternatives.length })}
          </button>

          {showAlternatives && (
            <div className="mt-2 space-y-1" role="listbox" aria-label={t('nameSuggestion.showAlternatives', { count: alternatives.length })}>
              {alternatives.map((alt, index) => (
                <button
                  key={`${alt.name}-${index}`}
                  onClick={() => handleAcceptAlternative(index)}
                  onFocus={() => setFocusedIndex(index + 1)}
                  role="option"
                  aria-selected={focusedIndex === index + 1}
                  title={alt.name}
                  className={`w-full text-left px-3 py-2 rounded text-sm text-content truncate transition-colors ${
                    focusedIndex === index + 1
                      ? 'bg-surface ring-2 ring-accent/30'
                      : 'hover:bg-surface'
                  }`}
                >
                  {alt.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-stroke bg-surface/50 rounded-b-lg">
        <p className="text-xs text-content-tertiary">{t('nameSuggestion.hint')}</p>
      </div>
    </div>,
    document.body
  );
}
