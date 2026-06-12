import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../cn';
import { intentBackgrounds, intentText, sizeText } from '../variants';

const containerVariants = cva(['flex flex-col items-center', 'text-center'], {
  variants: {
    size: {
      md: ['gap-2', 'py-8'],
      lg: ['gap-3', 'py-12'],
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const iconVariants = cva(['flex items-center justify-center', 'shrink-0'], {
  variants: {
    iconStyle: {
      bare: 'opacity-50',
      tile: 'rounded-xl',
      circle: 'rounded-full',
    },
    tint: {
      neutral: '',
      error: '',
      warning: '',
    },
    size: {
      md: 'h-12 w-12',
      lg: '',
    },
  },
  compoundVariants: [
    { iconStyle: ['tile', 'circle'], tint: 'neutral', class: 'bg-surface-elevated' },
    {
      iconStyle: ['tile', 'circle'],
      tint: 'error',
      class: [intentBackgrounds.error, intentText.error],
    },
    {
      iconStyle: ['tile', 'circle'],
      tint: 'warning',
      class: [intentBackgrounds.warning, intentText.warning],
    },
    { iconStyle: ['bare', 'tile'], size: 'lg', class: 'h-12 w-12' },
    { iconStyle: 'circle', size: 'lg', class: 'h-16 w-16' },
  ],
  defaultVariants: {
    iconStyle: 'bare',
    tint: 'neutral',
    size: 'md',
  },
});

const titleVariants = cva(['font-medium text-content-secondary'], {
  variants: {
    size: {
      md: sizeText.md,
      lg: sizeText.lg,
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const descriptionVariants = cva(['text-content-tertiary'], {
  variants: {
    size: {
      md: 'text-xs',
      lg: sizeText.md,
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * Icon node. Callers supply their own icon; there is no default.
   */
  icon?: ReactNode;

  /**
   * Visual treatment of the icon.
   * - bare: faded icon with no container
   * - tile: icon in a rounded square
   * - circle: icon in a tinted circle
   *
   * @default 'bare'
   */
  iconStyle?: 'bare' | 'tile' | 'circle';

  /**
   * Circle/tile tint.
   * - neutral: surface-elevated background
   * - error: error-muted background, error text (sets role="alert")
   * - warning: warning-muted background, warning text
   *
   * @default 'neutral'
   */
  tint?: 'neutral' | 'error' | 'warning';

  /**
   * Primary message.
   */
  title: string;

  /**
   * Secondary hint line.
   */
  description?: string;

  /**
   * CTA slot — callers compose existing Buttons or link-buttons,
   * rendered in a centered gap row.
   */
  actions?: ReactNode;

  /**
   * Extra detail slot below actions (e.g. an error `<pre>` block).
   */
  detail?: ReactNode;

  /**
   * Overall scale.
   * - md: panel empty states
   * - lg: full-screen empty states (larger circle and type)
   *
   * @default 'md'
   */
  size?: 'md' | 'lg';
}

/**
 * Centered icon + heading + secondary message + optional CTA for
 * no-data panels, empty search results, and error boundaries.
 *
 * @example
 * // No-data panel with CTA
 * <EmptyState
 *   icon={<LayoutListIcon />}
 *   title="No layouts yet"
 *   description="Create your first layout to get started"
 *   actions={<Button variant="primary">New Layout</Button>}
 * />
 *
 * @example
 * // No search results (text-only)
 * <EmptyState title="No results" description="Try a different search" />
 *
 * @example
 * // Dialog list empty with tiled icon
 * <EmptyState iconStyle="tile" icon={<SearchIcon />} title="No designs found" />
 *
 * @example
 * // Full-screen error boundary
 * <EmptyState
 *   size="lg"
 *   iconStyle="circle"
 *   tint="error"
 *   icon={<AlertTriangleIcon />}
 *   title="Something went wrong"
 *   description="The layout failed to render"
 *   actions={
 *     <>
 *       <Button variant="primary" onClick={retry}>Try Again</Button>
 *       <Button onClick={reload}>Reload</Button>
 *     </>
 *   }
 *   detail={<pre>{error.message}</pre>}
 * />
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      icon,
      iconStyle,
      tint = 'neutral',
      title,
      description,
      actions,
      detail,
      size,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        role={tint === 'error' ? 'alert' : undefined}
        className={cn(containerVariants({ size }), className)}
        {...props}
      >
        {icon !== undefined && icon !== null && (
          <div
            aria-hidden="true"
            data-testid="empty-state-icon"
            className={cn(iconVariants({ iconStyle, tint, size }))}
          >
            {icon}
          </div>
        )}
        <p className={cn(titleVariants({ size }))}>{title}</p>
        {description !== undefined && (
          <p className={cn(descriptionVariants({ size }))}>{description}</p>
        )}
        {actions !== undefined && actions !== null && (
          <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div>
        )}
        {detail}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';
