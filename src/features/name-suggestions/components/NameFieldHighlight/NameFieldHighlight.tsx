/**
 * Highlight wrapper for the name input field.
 *
 * Shows either:
 * - Inline ghost text + Tab hint for high-confidence suggestions (>=0.7)
 * - Pulsing highlight + badge for lower-confidence suggestions
 *
 * Both modes open the popover on click for alternatives.
 */

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useTranslation } from '@/i18n';
import { useSuggestionTrigger, useNameSuggestions } from '../../hooks';
import { SuggestionPopover } from '../SuggestionPopover';

interface NameFieldHighlightProps {
  /** The name input element to wrap */
  children: ReactNode;
}

/**
 * Wrapper that adds pulsing highlight and suggestion popover to the name field.
 */
export function NameFieldHighlight({ children }: NameFieldHighlightProps) {
  const t = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Initialize the suggestion trigger (monitors layout and generates suggestions)
  const { triggerSuggestions } = useSuggestionTrigger();

  const { showHighlight, showHighConfidenceInline, primarySuggestion, acceptPrimary, collapse } =
    useNameSuggestions();

  // Listen for command palette trigger event
  const handleTriggerEvent = useCallback(() => {
    // Manually trigger suggestions from command palette (async)
    void triggerSuggestions('command').then((result) => {
      if (result.primary) {
        setIsPopoverOpen(true);
      }
    });
  }, [triggerSuggestions]);

  useEffect(() => {
    window.addEventListener('trigger-name-suggestions', handleTriggerEvent);
    return () => window.removeEventListener('trigger-name-suggestions', handleTriggerEvent);
  }, [handleTriggerEvent]);

  // Reset animation state when highlight goes away
  // Use queueMicrotask to avoid synchronous setState in effect body
  useEffect(() => {
    if (!showHighlight) {
      queueMicrotask(() => setHasAnimated(false));
    }
  }, [showHighlight]);

  // Handle animation timing when highlight appears
  useEffect(() => {
    if (showHighlight && !hasAnimated) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
      }, 800); // Animation duration

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showHighlight, hasAnimated]);

  // Tab key handler for accepting high-confidence inline suggestions
  useEffect(() => {
    if (!showHighConfidenceInline) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Tab when not in a text input and not with Shift
      if (e.key === 'Tab' && !e.shiftKey) {
        // Check if focus is within our wrapper or document is focused on body
        const activeElement = document.activeElement;
        const isInputFocused =
          activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;

        // Don't intercept Tab if user is typing in an input
        if (isInputFocused) return;

        // Accept the suggestion
        e.preventDefault();
        acceptPrimary();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showHighConfidenceInline, acceptPrimary]);

  // Handle click on the wrapper
  const handleClick = () => {
    if (showHighlight) {
      setIsPopoverOpen(true);
    }
  };

  // Handle closing the popover
  const handleClosePopover = () => {
    setIsPopoverOpen(false);
    collapse();
  };

  // Show highlight styling only for low-confidence suggestions (not inline mode)
  const showLowConfidenceHighlight = showHighlight && !showHighConfidenceInline;

  return (
    <div className="relative inline-flex items-center gap-1">
      <div
        ref={wrapperRef}
        {...(showHighlight && {
          onClick: handleClick,
          role: 'button' as const,
          tabIndex: 0,
          onKeyDown: (e: ReactKeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick();
            }
          },
        })}
        className={`
          relative rounded transition-all duration-300
          ${showHighlight ? 'cursor-pointer' : ''}
          ${
            showLowConfidenceHighlight && !hasAnimated
              ? 'animate-suggestion-pulse'
              : showLowConfidenceHighlight
                ? 'ring-2 ring-accent/40'
                : ''
          }
        `}
      >
        {children}

        {/* Suggestion indicator badge - only for low-confidence mode */}
        {showLowConfidenceHighlight && (
          <div
            className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full flex items-center justify-center"
            title={t('nameSuggestion.title')}
          >
            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Inline ghost text for high-confidence suggestions */}
      {showHighConfidenceInline && primarySuggestion && (
        <button
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 text-sm text-content-tertiary/50 hover:text-content-tertiary transition-colors cursor-pointer"
          title={t('nameSuggestion.pressTabToAccept')}
          aria-label={t('nameSuggestion.suggestedName', { name: primarySuggestion.name })}
        >
          <span className="truncate max-w-[120px]" aria-hidden="true">
            {primarySuggestion.name}
          </span>
          <kbd className="px-1 py-0.5 text-[10px] font-medium bg-surface-secondary border border-stroke-subtle rounded text-content-tertiary">
            Tab
          </kbd>
        </button>
      )}

      {/* Suggestion popover */}
      <SuggestionPopover
        anchorRef={wrapperRef}
        isOpen={isPopoverOpen}
        onClose={handleClosePopover}
      />
    </div>
  );
}
