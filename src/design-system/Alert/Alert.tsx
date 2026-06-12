import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { cn } from '../cn';
import { XIcon } from '../Icon';
import { focusRing, intentBackgrounds, intentText, interactiveTransition } from '../variants';

const alertVariants = cva(['flex items-start gap-2', 'rounded-md border'], {
  variants: {
    intent: {
      error: [intentBackgrounds.error, 'border-error'],
      warning: [intentBackgrounds.warning, 'border-warning'],
      success: [intentBackgrounds.success, 'border-success'],
      info: [intentBackgrounds.info, 'border-info'],
    },
    size: {
      sm: ['p-2', 'text-xs'],
      md: ['p-3', 'text-sm'],
    },
  },
  defaultVariants: {
    size: 'sm',
  },
});

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Feedback intent. Maps to muted background, matching border, and
   * intent-colored title/icon. `error` announces assertively (`role="alert"`),
   * the rest politely (`role="status"`).
   */
  intent: 'error' | 'warning' | 'success' | 'info';

  /**
   * Bold first line (e.g. 'Import failed').
   */
  title?: string;

  /**
   * Optional leading icon node. Callers supply their own icon; decorative
   * (hidden from assistive technology).
   */
  icon?: ReactNode;

  /**
   * Body content: text, error lists, key/value grids, inline action buttons,
   * or kbd chips.
   */
  children?: ReactNode;

  /**
   * Renders a trailing dismiss button. The Alert is controlled — the caller
   * unmounts it (and owns any auto-dismiss timers).
   */
  onDismiss?: () => void;

  /**
   * Accessible name for the dismiss button.
   *
   * @default 'Dismiss'
   */
  dismissAriaLabel?: string;

  /**
   * Density scale: `sm` for inline field-adjacent messages, `md` for dialog
   * banners.
   *
   * @default 'sm'
   */
  size?: 'sm' | 'md';
}

/**
 * Tone-tinted inline message box for validation errors, warnings, success
 * confirmations, and status banners.
 *
 * @example
 * <Alert intent="error" title="Import failed">
 *   <ul className="list-disc pl-4">
 *     {errors.map((e) => (
 *       <li key={e}>{e}</li>
 *     ))}
 *   </ul>
 * </Alert>
 *
 * @example
 * <Alert intent="warning" icon={<AlertTriangleIcon size="sm" />}>
 *   This layout exceeds the print bed.
 * </Alert>
 *
 * @example
 * <Alert intent="info" size="md" onDismiss={exitKeyboardMode} dismissAriaLabel={t('a11y.dismiss')}>
 *   Keyboard mode active
 * </Alert>
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      intent,
      title,
      icon,
      children,
      onDismiss,
      dismissAriaLabel = 'Dismiss',
      size = 'sm',
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        role={intent === 'error' ? 'alert' : 'status'}
        className={cn(alertVariants({ intent, size }), className)}
        {...props}
      >
        {icon && (
          <span className={cn('flex-shrink-0', intentText[intent])} aria-hidden="true">
            {icon}
          </span>
        )}

        <div className="flex-1 min-w-0">
          {title && <p className={cn('font-semibold', intentText[intent])}>{title}</p>}
          {children}
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={dismissAriaLabel}
            className={cn(
              'flex-shrink-0 -m-1 p-1',
              'flex items-center justify-center',
              'rounded',
              'text-current opacity-60',
              'hover:opacity-100',
              interactiveTransition,
              ...focusRing
            )}
          >
            <XIcon size="xs" />
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';
