import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';

const spinnerVariants = cva(
  [
    'inline-block',
    'animate-spin',
    'rounded-full',
    'border-2',
    'border-current',
    'border-t-transparent',
  ],
  {
    variants: {
      size: {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof spinnerVariants> {
  /**
   * Accessible label for screen readers.
   * @default "Loading"
   */
  label?: string;
}

/**
 * Animated loading indicator.
 *
 * @example
 * // Default size
 * <Spinner />
 *
 * @example
 * // Large with custom label
 * <Spinner size="lg" label="Saving changes" />
 *
 * @example
 * // Inside a button
 * <Button disabled>
 *   <Spinner size="sm" /> Loading...
 * </Button>
 */
export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ size, label = 'Loading', className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        role="status"
        aria-label={label}
        className={cn(spinnerVariants({ size }), className)}
        {...props}
      >
        <span className="sr-only">{label}</span>
      </span>
    );
  }
);

Spinner.displayName = 'Spinner';
