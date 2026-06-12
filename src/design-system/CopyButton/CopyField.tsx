import { forwardRef } from 'react';
import { cn } from '../cn';
import { Input } from '../Input';
import { CopyButton } from './CopyButton';

export interface CopyFieldProps {
  /**
   * Text shown in the read-only field and copied by the button.
   */
  value: string;

  /**
   * Accessible label for the read-only input.
   */
  'aria-label': string;

  /**
   * Accessible name for the copy button.
   */
  copyAriaLabel: string;

  /**
   * Visible label and announcement while in the copied state.
   * @default 'Copied'
   */
  copiedLabel?: string;

  /**
   * Render the value in a monospace font.
   * @default true
   */
  mono?: boolean;

  /**
   * Called after a successful copy.
   */
  onCopied?: () => void;
}

/**
 * Read-only value row with an adjacent copy button.
 * Clicking the field selects its full contents.
 *
 * @example
 * <CopyField
 *   value={shareUrl}
 *   aria-label="Share link"
 *   copyAriaLabel="Copy share link"
 * />
 *
 * @example
 * // Non-URL payload without monospace
 * <CopyField
 *   value={layoutName}
 *   aria-label="Layout name"
 *   copyAriaLabel="Copy layout name"
 *   mono={false}
 *   onCopied={() => toast.success('Copied')}
 * />
 */
export const CopyField = forwardRef<HTMLInputElement, CopyFieldProps>(
  ({ value, 'aria-label': ariaLabel, copyAriaLabel, copiedLabel, mono = true, onCopied }, ref) => {
    return (
      <div className="flex items-center gap-2">
        <Input
          ref={ref}
          readOnly
          value={value}
          aria-label={ariaLabel}
          wrapperClassName="min-w-0 flex-1"
          className={cn(mono && 'font-mono')}
          onClick={(event) => event.currentTarget.select()}
        />
        <CopyButton
          value={value}
          aria-label={copyAriaLabel}
          copiedLabel={copiedLabel}
          onCopied={onCopied}
        />
      </div>
    );
  }
);

CopyField.displayName = 'CopyField';
