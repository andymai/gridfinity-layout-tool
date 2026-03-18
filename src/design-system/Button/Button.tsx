import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';
import { Spinner } from '../Spinner';
import {
  focusRing,
  disabledStyles,
  interactiveTransition,
  touchTarget,
  sizeGaps,
  variantColors,
} from '../variants';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center',
    'rounded-md font-medium',
    interactiveTransition,
    ...focusRing,
    ...disabledStyles,
  ],
  {
    variants: {
      variant: {
        primary: variantColors.primary,
        secondary: variantColors.secondary,
        ghost: variantColors.ghost,
        danger: variantColors.danger,
      },
      size: {
        sm: ['h-6', 'px-1.5', 'text-xs', sizeGaps.sm],
        md: ['py-2', 'px-4', 'text-sm', sizeGaps.md],
        lg: ['h-12', 'px-5', 'text-base', sizeGaps.lg],
      },
      iconOnly: {
        true: 'aspect-square !px-0 justify-center',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    compoundVariants: [
      { size: 'sm', iconOnly: true, class: 'w-6' },
      { size: 'md', iconOnly: true, class: 'w-9' },
      { size: 'lg', iconOnly: true, class: 'w-12' },
    ],
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  }
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

// Button props

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {
  /**
   * Shows loading spinner and disables interaction.
   * The spinner replaces the leftIcon when loading.
   */
  loading?: boolean;

  /**
   * Icon displayed before children.
   * Replaced by Spinner when `loading` is true.
   */
  leftIcon?: React.ReactNode;

  /**
   * Icon displayed after children.
   */
  rightIcon?: React.ReactNode;

  /**
   * Enforce 44px minimum touch target (Apple HIG).
   * Defaults to `true` for iconOnly buttons, `false` otherwise.
   */
  touchTarget?: boolean;
}

// Button component

/**
 * Interactive element for triggering actions.
 *
 * @example
 * // Primary action
 * <Button variant="primary">Save Layout</Button>
 *
 * @example
 * // Icon-only button (requires aria-label)
 * <Button iconOnly aria-label="Close">
 *   <XIcon />
 * </Button>
 *
 * @example
 * // With icons
 * <Button leftIcon={<PlusIcon />}>Add Item</Button>
 *
 * @example
 * // Loading state
 * <Button loading variant="primary">
 *   Saving...
 * </Button>
 *
 * @example
 * // Destructive action
 * <Button variant="danger" leftIcon={<TrashIcon />}>
 *   Delete
 * </Button>
 *
 * @example
 * // Full width
 * <Button fullWidth variant="primary">
 *   Continue
 * </Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant,
      size,
      iconOnly,
      fullWidth,
      loading,
      leftIcon,
      rightIcon,
      touchTarget: touchTargetProp,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const hasTouchTarget = touchTargetProp ?? iconOnly === true;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          buttonVariants({ variant, size, iconOnly, fullWidth }),
          hasTouchTarget && touchTarget,
          className
        )}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Spinner size={size === 'lg' ? 'md' : 'sm'} /> : leftIcon}
        {children}
        {rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
