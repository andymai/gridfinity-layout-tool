import { useState, useEffect, useRef, useCallback } from 'react';

interface TwoClickDeleteButtonProps {
  /** Called when delete is confirmed (second click) */
  onDelete: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Label for the initial state */
  label: string;
  /** Label for the confirmation state */
  confirmLabel: string;
  /** Optional subtext shown when confirming (e.g., "5 bins will be deleted") */
  confirmSubtext?: string;
  /** Additional className for the button */
  className?: string;
  /** Called when the confirming state resets (e.g., click outside) */
  onReset?: () => void;
}

/**
 * A delete button that requires two clicks to confirm.
 *
 * First click: Shows confirmation state (changes appearance)
 * Second click: Executes the delete action
 *
 * The confirmation state resets when:
 * - User clicks outside the button
 * - Parent component unmounts or hides the button
 *
 * This provides a safer UX than instant delete without the
 * disruption of a full confirmation dialog.
 */
export function TwoClickDeleteButton({
  onDelete,
  disabled = false,
  label,
  confirmLabel,
  confirmSubtext,
  className = '',
  onReset,
}: TwoClickDeleteButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Reset confirmation state on click outside
  useEffect(() => {
    if (!isConfirming) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsConfirming(false);
        onReset?.();
      }
    };

    // Use a small delay to avoid resetting on the same click that opened the menu
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isConfirming, onReset]);

  // Reset confirmation state when disabled changes
  useEffect(() => {
    if (disabled) {
      setIsConfirming(false);
    }
  }, [disabled]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;

      if (isConfirming) {
        onDelete();
        setIsConfirming(false);
      } else {
        setIsConfirming(true);
      }
    },
    [disabled, isConfirming, onDelete]
  );

  const baseStyles = 'w-full px-3 py-2 text-left text-sm flex flex-col gap-0.5 transition-colors';
  const stateStyles = isConfirming
    ? 'bg-danger text-on-dark'
    : 'text-danger hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <button
      ref={buttonRef}
      type="button"
      role="menuitem"
      onClick={handleClick}
      disabled={disabled}
      className={`${baseStyles} ${stateStyles} ${className}`}
    >
      <span className="flex items-center gap-2">
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        {isConfirming ? confirmLabel : label}
      </span>
      {isConfirming && confirmSubtext && (
        <span className="text-xs opacity-70 ml-6">{confirmSubtext}</span>
      )}
    </button>
  );
}

/**
 * Hook to manage two-click delete state externally.
 * Useful when the button is part of a larger component that needs
 * to coordinate the confirming state (e.g., keep a menu open).
 */
export function useTwoClickDelete(onDelete: () => void) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleClick = useCallback(() => {
    if (isConfirming) {
      onDelete();
      setIsConfirming(false);
    } else {
      setIsConfirming(true);
    }
  }, [isConfirming, onDelete]);

  const reset = useCallback(() => {
    setIsConfirming(false);
  }, []);

  return { isConfirming, handleClick, reset };
}
