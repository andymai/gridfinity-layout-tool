import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../cn';
import { focusRing, interactiveTransition, intentBackgrounds, intentText } from '../variants';

const badgeVariants = cva(
  ['inline-flex items-center gap-1', 'font-medium leading-none whitespace-nowrap'],
  {
    variants: {
      tone: {
        neutral: ['bg-surface-hover', 'text-content-tertiary'],
        accent: ['bg-accent', 'text-on-accent'],
        success: [intentBackgrounds.success, intentText.success],
        warning: [intentBackgrounds.warning, intentText.warning],
        error: [intentBackgrounds.error, intentText.error],
        info: [intentBackgrounds.info, intentText.info],
        overlay: ['bg-black/70', 'text-white'],
      },
      shape: {
        rounded: 'rounded-md',
        pill: 'rounded-full',
      },
      size: {
        sm: ['text-[10px]', 'px-1.5', 'py-0.5'],
        md: ['text-xs', 'px-2', 'py-0.5'],
      },
    },
    defaultVariants: {
      tone: 'neutral',
      shape: 'rounded',
      size: 'sm',
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Visual tone of the badge.
   * - neutral: counts and quiet metadata
   * - accent: active/selected chips
   * - success/warning/error/info: feedback and status chips
   * - overlay: badges layered over thumbnails or imagery
   *
   * @default 'neutral'
   */
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'overlay';

  /**
   * Corner shape. 'rounded' for status chips, 'pill' for count and tag pills.
   *
   * @default 'rounded'
   */
  shape?: 'rounded' | 'pill';

  /**
   * Text scale and padding.
   *
   * @default 'sm'
   */
  size?: 'sm' | 'md';

  /**
   * Renders a trailing remove button inside the chip.
   */
  onRemove?: () => void;

  /**
   * Accessible name for the remove button.
   *
   * @default 'Remove'
   */
  removeAriaLabel?: string;

  /**
   * Badge content: text, a count string, or a leading swatch/icon node plus text.
   */
  children: ReactNode;
}

/**
 * Compact chip for statuses, counts, tags, and overlay labels.
 *
 * @example
 * // Status chip
 * <Badge tone="warning">Experimental</Badge>
 *
 * @example
 * // Count pill
 * <Badge shape="pill" title="3 staged bins">3</Badge>
 *
 * @example
 * // Removable tag
 * <Badge shape="pill" onRemove={() => removeTag(tag)} removeAriaLabel={`Remove ${tag}`}>
 *   {tag}
 * </Badge>
 *
 * @example
 * // Overlay badge on a thumbnail
 * <Badge tone="overlay" size="md">4 layers</Badge>
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    { tone, shape, size, onRemove, removeAriaLabel = 'Remove', className, children, ...props },
    ref
  ) => {
    return (
      <span ref={ref} className={cn(badgeVariants({ tone, shape, size }), className)} {...props}>
        {children}
        {onRemove && (
          <button
            type="button"
            aria-label={removeAriaLabel}
            onClick={onRemove}
            className={cn(
              'rounded-sm p-0.5 opacity-70 hover:opacity-100',
              interactiveTransition,
              focusRing
            )}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-2.5 w-2.5"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
