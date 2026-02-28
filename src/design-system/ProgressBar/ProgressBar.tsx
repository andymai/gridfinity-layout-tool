import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';

const trackVariants = cva(['w-full overflow-hidden rounded-full bg-surface-hover'], {
  variants: {
    size: {
      sm: 'h-1.5',
      md: 'h-2.5',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const fillVariants = cva(['h-full rounded-full transition-[width] duration-300 ease-out'], {
  variants: {
    indeterminate: {
      true: 'animate-progress-indeterminate bg-accent w-1/3',
      false: 'bg-accent',
    },
  },
  defaultVariants: {
    indeterminate: false,
  },
});

export interface ProgressBarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'role'>, VariantProps<typeof trackVariants> {
  /** Progress value 0–100. Omit for indeterminate. */
  value?: number;
  /** Accessible label for screen readers. */
  label?: string;
}

/**
 * Determinate or indeterminate progress bar.
 *
 * @example
 * <ProgressBar value={60} label="Exporting piece 3 of 5" />
 *
 * @example
 * <ProgressBar label="Loading..." />
 */
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ value, label, size, className, ...props }, ref) => {
    const isDeterminate = value !== undefined;
    const clampedValue = isDeterminate ? Math.max(0, Math.min(100, value)) : undefined;

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={isDeterminate ? 0 : undefined}
        aria-valuemax={isDeterminate ? 100 : undefined}
        aria-label={label}
        className={cn(trackVariants({ size }), className)}
        {...props}
      >
        <div
          className={cn(fillVariants({ indeterminate: !isDeterminate }))}
          style={isDeterminate ? { width: `${clampedValue}%` } : undefined}
        />
      </div>
    );
  }
);

ProgressBar.displayName = 'ProgressBar';
