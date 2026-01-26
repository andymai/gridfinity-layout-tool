/**
 * Highlight wrapper for the name input field.
 *
 * Shows a pulsing glow when suggestions are available,
 * drawing user attention to click and see suggestions.
 */

import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useTranslation } from '@/i18n';
import { useSuggestionTrigger, useNameSuggestions } from '../hooks';
import { SuggestionPopover } from './SuggestionPopover';

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

  const { showHighlight, collapse, primarySuggestion } = useNameSuggestions();

  // Listen for command palette trigger event
  const handleTriggerEvent = useCallback(() => {
    // Manually trigger suggestions from command palette (async)
    triggerSuggestions('command').then((result) => {
      if (result.primary) {
        setIsPopoverOpen(true);
      }
    });
  }, [triggerSuggestions]);

  useEffect(() => {
    window.addEventListener('trigger-name-suggestions', handleTriggerEvent);
    return () => window.removeEventListener('trigger-name-suggestions', handleTriggerEvent);
  }, [handleTriggerEvent]);

  // Open popover when suggestions are ready from command trigger
  useEffect(() => {
    if (showHighlight && primarySuggestion) {
      // Auto-open popover if triggered from command
      // (The store tracks trigger source)
    }
  }, [showHighlight, primarySuggestion]);

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

  return (
    <div className="relative inline-block">
      <div
        ref={wrapperRef}
        onClick={handleClick}
        className={`
          relative rounded transition-all duration-300
          ${showHighlight ? 'cursor-pointer' : ''}
          ${
            showHighlight && !hasAnimated
              ? 'animate-suggestion-pulse'
              : showHighlight
                ? 'ring-2 ring-accent/40'
                : ''
          }
        `}
      >
        {children}

        {/* Suggestion indicator badge */}
        {showHighlight && (
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

      {/* Suggestion popover */}
      <SuggestionPopover
        anchorRef={wrapperRef}
        isOpen={isPopoverOpen}
        onClose={handleClosePopover}
      />
    </div>
  );
}
