import { forwardRef, type ReactNode } from 'react';
import { cn } from '../cn';
import { Button } from '../Button';
import { Spinner } from '../Spinner';

export interface IconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-label'
> {
  /**
   * Accessible name for the control. Required because the visible
   * content is an icon with no text.
   */
  'aria-label': string;

  /**
   * The icon to display — an Icon primitive or inline svg.
   */
  children: ReactNode;

  /**
   * Visual style.
   * - ghost: transparent until hovered
   * - secondary: bordered/elevated
   * - dangerGhost: ghost that turns destructive red on hover
   * @default 'ghost'
   */
  variant?: 'ghost' | 'secondary' | 'dangerGhost';

  /**
   * Control size: sm (w-6), md (w-9), lg (w-12).
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Toggle state. Emits `aria-pressed` and applies active styling when true.
   * Omit entirely for non-toggle buttons (no `aria-pressed` attribute).
   */
  pressed?: boolean;

  /**
   * Swaps the icon for a Spinner, disables interaction, and sets `aria-busy`.
   */
  loading?: boolean;

  /**
   * Enforce 44px minimum touch target (Apple HIG).
   * Defaults to `true`; dense desktop toolbars pass `false`.
   */
  touchTarget?: boolean;
}

/**
 * Icon-only button for toolbars, panel headers, and inline actions.
 *
 * @example
 * // Dialog close button
 * <IconButton aria-label="Close dialog">
 *   <XIcon />
 * </IconButton>
 *
 * @example
 * // Destructive hover treatment for delete actions
 * <IconButton aria-label="Delete category" variant="dangerGhost">
 *   <TrashIcon />
 * </IconButton>
 *
 * @example
 * // Dense desktop toolbar toggle
 * <IconButton
 *   aria-label="Align left"
 *   size="sm"
 *   touchTarget={false}
 *   pressed={alignment === 'left'}
 * >
 *   <AlignLeftIcon />
 * </IconButton>
 *
 * @example
 * // Async action in progress
 * <IconButton aria-label="Refresh share" loading={isRefreshing}>
 *   <RefreshIcon />
 * </IconButton>
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = 'ghost',
      size = 'md',
      pressed,
      loading,
      touchTarget,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <Button
        ref={ref}
        iconOnly
        size={size}
        variant={variant === 'dangerGhost' ? 'ghost' : variant}
        touchTarget={touchTarget}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-pressed={pressed}
        className={cn(
          variant === 'dangerGhost' && 'hover:text-error hover:bg-error-muted',
          pressed && 'bg-surface-active text-content',
          className
        )}
        {...props}
      >
        {loading ? <Spinner size="sm" /> : children}
      </Button>
    );
  }
);

IconButton.displayName = 'IconButton';
