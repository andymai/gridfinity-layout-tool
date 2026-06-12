import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../cn';
import { disabledStyles, focusRing, interactiveTransition } from '../variants';

const textareaVariants = cva(
  [
    'w-full',
    'bg-surface',
    'border border-stroke',
    'rounded-md',
    'p-3',
    'text-sm text-content',
    'placeholder:text-content-disabled',
    interactiveTransition,
    'hover:border-stroke-strong',
    ...focusRing,
    ...disabledStyles,
  ],
  {
    variants: {
      mono: {
        true: 'font-mono',
      },
      resize: {
        none: 'resize-none',
        vertical: 'resize-y',
      },
    },
    defaultVariants: {
      resize: 'vertical',
    },
  }
);

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Monospace styling for JSON paste/view areas.
   * @default false
   */
  mono?: boolean;

  /**
   * Resize behavior. Use 'none' for fixed JSON panes.
   * @default 'vertical'
   */
  resize?: 'none' | 'vertical';

  /**
   * Select the entire content on click.
   * Read-only viewer affordance; keyboard select-all keeps working natively.
   * @default false
   */
  selectOnClick?: boolean;

  /**
   * With maxLength, renders a 'length/maxLength' counter below the textarea.
   * Requires a controlled value to count.
   * @default false
   */
  showCount?: boolean;
}

/**
 * Multi-line text input with consistent styling.
 *
 * Label association is the caller's responsibility (pair with a label via htmlFor).
 *
 * @example
 * // Notes field with character counter
 * <Textarea
 *   rows={3}
 *   value={notes}
 *   onChange={e => setNotes(e.target.value)}
 *   maxLength={500}
 *   showCount
 *   aria-label="Notes"
 * />
 *
 * @example
 * // Read-only JSON viewer
 * <Textarea mono readOnly selectOnClick resize="none" value={json} aria-label="Share data" />
 *
 * @example
 * // JSON paste area
 * <Textarea
 *   mono
 *   resize="none"
 *   className="min-h-[200px] flex-1"
 *   placeholder="Paste layout JSON here"
 *   value={input}
 *   onChange={e => setInput(e.target.value)}
 * />
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      mono = false,
      resize = 'vertical',
      selectOnClick = false,
      showCount = false,
      className,
      onClick,
      value,
      maxLength,
      ...props
    },
    ref
  ) => {
    const handleClick = (event: React.MouseEvent<HTMLTextAreaElement>): void => {
      if (selectOnClick) {
        event.currentTarget.select();
      }
      onClick?.(event);
    };

    const textarea = (
      <textarea
        ref={ref}
        value={value}
        maxLength={maxLength}
        onClick={handleClick}
        className={cn(textareaVariants({ mono, resize }), className)}
        {...props}
      />
    );

    if (!showCount) {
      return textarea;
    }

    return (
      <div className="w-full">
        {textarea}
        {maxLength !== undefined && (
          <div className="text-right text-xs text-content-tertiary" aria-hidden="true">
            {String(value ?? '').length}/{maxLength}
          </div>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
