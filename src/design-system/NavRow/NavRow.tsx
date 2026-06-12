import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';
import { focusRing, disabledStyles, interactiveTransition, activePress } from '../variants';

const navRowVariants = cva(
  [
    'group w-full flex items-center gap-3 p-3 rounded-lg text-left',
    interactiveTransition,
    activePress,
    ...focusRing,
    ...disabledStyles,
  ],
  {
    variants: {
      variant: {
        plain: ['bg-surface-elevated border border-stroke-subtle', 'hover:bg-surface-hover'],
        promo: [
          'bg-gradient-to-r from-accent/10 to-info/10',
          'hover:from-accent/20 hover:to-info/20',
          'border border-accent/20',
        ],
      },
    },
    defaultVariants: {
      variant: 'plain',
    },
  }
);

type NavRowVariantProps = VariantProps<typeof navRowVariants>;

const iconTints = {
  neutral: 'bg-surface-elevated',
  accent: 'bg-accent/20 text-accent',
} as const;

const defaultChevron = (
  <svg
    aria-hidden="true"
    data-testid="nav-row-chevron"
    className="w-4 h-4 text-content-tertiary shrink-0 transition-transform group-hover:translate-x-0.5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export interface NavRowProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'>, NavRowVariantProps {
  /**
   * Leading icon node, rendered inside a w-10 h-10 rounded-lg tile.
   */
  icon: React.ReactNode;

  /**
   * Tile tint. Arbitrary tints go via `iconClassName`.
   * @default 'neutral'
   */
  iconTint?: 'neutral' | 'accent';

  /**
   * Extra classes for the icon tile (e.g. per-option background/text colors).
   */
  iconClassName?: string;

  /**
   * Primary row label.
   */
  title: string;

  /**
   * Secondary line below the title.
   */
  subtitle?: string;

  /**
   * Trailing node. Pass `null` to omit, or a custom node to replace.
   * @default chevron-right icon
   */
  trailing?: React.ReactNode | null;

  /**
   * Row surface style.
   * @default 'plain'
   */
  variant?: 'plain' | 'promo';
}

/**
 * Full-width navigation/CTA row with a leading icon tile, title/subtitle
 * block, and trailing chevron.
 *
 * @example
 * // Plain settings row
 * <NavRow icon={<GearIcon />} title="Print settings" subtitle="Nozzle, bed size" onClick={openSettings} />
 *
 * @example
 * // Gradient promo card
 * <NavRow
 *   variant="promo"
 *   iconTint="accent"
 *   icon={<GridIcon />}
 *   title="Inspiration gallery"
 *   subtitle="Get ideas for your drawer"
 *   onClick={openGallery}
 * />
 *
 * @example
 * // Custom tile tint, no chevron
 * <NavRow
 *   icon={<CloudIcon />}
 *   iconClassName="bg-purple-500/20 text-purple-500"
 *   title="Share to cloud"
 *   trailing={null}
 *   onClick={shareToCloud}
 * />
 */
export const NavRow = forwardRef<HTMLButtonElement, NavRowProps>(
  (
    {
      icon,
      iconTint = 'neutral',
      iconClassName,
      title,
      subtitle,
      trailing,
      variant,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(navRowVariants({ variant }), className)}
        {...props}
      >
        <span
          aria-hidden="true"
          data-testid="nav-row-icon-tile"
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
            'transition-transform group-hover:scale-105',
            iconTints[iconTint],
            iconClassName
          )}
        >
          {icon}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-content">{title}</span>
          {subtitle && <span className="block text-xs text-content-tertiary">{subtitle}</span>}
        </span>
        {trailing === undefined ? defaultChevron : trailing}
      </button>
    );
  }
);

NavRow.displayName = 'NavRow';
