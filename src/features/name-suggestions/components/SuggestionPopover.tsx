/**
 * Popover component for displaying name suggestions.
 *
 * Shows:
 * - Primary suggestion prominently
 * - Expandable alternatives section
 * - Dismiss button
 */

import { useEffect, useRef, useState } from 'react';
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
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const {
    primarySuggestion,
    alternatives,
    showAlternatives,
    acceptPrimary,
    acceptAlternative,
    dismiss,
    toggleAlternatives,
  } = useNameSuggestions();

  // Update position when anchor moves
  useEffect(() => {
    if (!isOpen || !anchorRef.current) return;

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) {
        setPosition({
          top: rect.bottom + 8,
          left: rect.left,
        });
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

  // Close on click outside
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

    // Close on Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, anchorRef, onClose]);

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
          onClick={handleAcceptPrimary}
          className="w-full text-left p-3 rounded-lg bg-accent/10 hover:bg-accent/20 border border-accent/20 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-content">{primarySuggestion.name}</span>
            <span className="text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
              {t('nameSuggestion.useThis')}
            </span>
          </div>
          <span className="text-xs text-content-secondary mt-1 block">
            {t(`nameSuggestion.source.${primarySuggestion.source}`)}
          </span>
        </button>
      </div>

      {/* Alternatives (expandable) */}
      {alternatives.length > 0 && (
        <div className="px-3 pb-3">
          <button
            onClick={toggleAlternatives}
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
            <div className="mt-2 space-y-1">
              {alternatives.map((alt, index) => (
                <button
                  key={alt.name}
                  onClick={() => handleAcceptAlternative(index)}
                  className="w-full text-left px-3 py-2 rounded text-sm text-content hover:bg-surface transition-colors"
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
