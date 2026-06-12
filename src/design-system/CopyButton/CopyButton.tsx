import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../cn';
import { Button } from '../Button';
import { iconSizes } from '../variants';

function copyViaSelection(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional fallback when the Clipboard API is unavailable (non-secure contexts)
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyViaSelection(text);
  }
}

interface InlineIconProps {
  className?: string;
  children: ReactNode;
}

function InlineIcon({ className, children }: InlineIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export interface CopyButtonProps {
  /**
   * Text to copy, or a lazy getter for computed payloads.
   */
  value: string | (() => string);

  /**
   * Accessible name for the button, e.g. 'Copy share link'.
   * Stays stable while copied; the state change is announced via a live region.
   */
  'aria-label': string;

  /**
   * Visible label next to the icon; omit for icon-only.
   * @default undefined
   */
  label?: string;

  /**
   * Visible label and announcement while in the copied state.
   * @default 'Copied'
   */
  copiedLabel?: string;

  /**
   * How long the copied state persists, in milliseconds.
   * @default 2000
   */
  timeoutMs?: number;

  /**
   * Called after a successful copy.
   */
  onCopied?: () => void;

  /**
   * Visual style passed through to Button.
   * @default 'secondary'
   */
  variant?: 'primary' | 'secondary' | 'ghost';

  /**
   * Size passed through to Button.
   * @default 'md'
   */
  size?: 'sm' | 'md';

  /**
   * Disable interaction.
   * @default false
   */
  disabled?: boolean;

  /**
   * Additional classes for the button.
   */
  className?: string;
}

/**
 * Copy-to-clipboard button with transient success feedback.
 *
 * Uses the async Clipboard API with an execCommand fallback for
 * non-secure contexts. The pending revert timer is cleared on
 * unmount and on re-click.
 *
 * @example
 * // Icon-only
 * <CopyButton value={shareUrl} aria-label="Copy share link" />
 *
 * @example
 * // With visible label and toast hookup
 * <CopyButton
 *   value={shareUrl}
 *   aria-label="Copy share link"
 *   label="Copy"
 *   copiedLabel="Copied"
 *   onCopied={() => toast.success('Link copied')}
 * />
 *
 * @example
 * // Lazy getter for computed payloads
 * <CopyButton
 *   value={() => JSON.stringify(exportLayout())}
 *   aria-label="Copy layout JSON"
 *   label="Copy JSON"
 *   variant="ghost"
 *   size="sm"
 * />
 */
export const CopyButton = forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      value,
      'aria-label': ariaLabel,
      label,
      copiedLabel = 'Copied',
      timeoutMs = 2000,
      onCopied,
      variant = 'secondary',
      size = 'md',
      disabled,
      className,
    },
    ref
  ) => {
    const [copied, setCopied] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
      () => () => {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
        }
      },
      []
    );

    const handleClick = useCallback(async () => {
      const text = typeof value === 'function' ? value() : value;
      const succeeded = await writeClipboardText(text);
      if (!succeeded) {
        return;
      }
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      setCopied(true);
      onCopied?.();
      timerRef.current = setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, timeoutMs);
    }, [value, onCopied, timeoutMs]);

    return (
      <Button
        ref={ref}
        type="button"
        variant={variant}
        size={size}
        iconOnly={label === undefined}
        disabled={disabled}
        aria-label={ariaLabel}
        className={className}
        onClick={() => void handleClick()}
        leftIcon={
          copied ? (
            <InlineIcon className={cn(iconSizes[size], 'text-success')}>
              <polyline points="20 6 9 17 4 12" data-testid="copy-button-check-icon" />
            </InlineIcon>
          ) : (
            <InlineIcon className={iconSizes[size]}>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </InlineIcon>
          )
        }
      >
        {label !== undefined && (copied ? copiedLabel : label)}
        <span aria-live="polite" className="sr-only">
          {copied ? copiedLabel : ''}
        </span>
      </Button>
    );
  }
);

CopyButton.displayName = 'CopyButton';
