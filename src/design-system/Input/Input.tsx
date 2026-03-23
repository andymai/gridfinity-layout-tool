import { forwardRef, useId } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';
import { disabledStyles, interactiveTransition } from '../variants';

const inputWrapperVariants = cva(
  [
    'relative',
    'inline-flex items-center',
    'bg-surface',
    'border border-stroke',
    'rounded-md',
    interactiveTransition,
    'hover:border-stroke-strong',
    'focus-within:border-accent',
    'focus-within:ring-1 focus-within:ring-accent',
  ],
  {
    variants: {
      size: {
        sm: 'h-7',
        md: 'py-2',
        lg: 'h-12',
      },
      error: {
        true: 'border-error focus-within:border-error focus-within:ring-error',
      },
      disabled: {
        true: 'opacity-50 cursor-not-allowed hover:border-stroke',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const inputVariants = cva(
  [
    'flex-1',
    'bg-transparent',
    'text-content',
    'placeholder:text-content-tertiary',
    'outline-none',
    'w-full',
    ...disabledStyles,
  ],
  {
    variants: {
      size: {
        sm: 'px-2 text-xs',
        md: 'px-3 text-sm',
        lg: 'px-4 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const iconWrapperVariants = cva(['flex-shrink-0', 'text-content-tertiary'], {
  variants: {
    size: {
      sm: 'w-3.5 h-3.5',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    },
    position: {
      left: 'ml-2',
      right: 'mr-2',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

type InputVariantProps = VariantProps<typeof inputWrapperVariants>;

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    Omit<InputVariantProps, 'error' | 'disabled'> {
  /**
   * Icon displayed at the start of the input.
   */
  leftIcon?: React.ReactNode;

  /**
   * Icon or element displayed at the end of the input.
   * Commonly used for clear buttons or validation icons.
   */
  rightIcon?: React.ReactNode;

  /**
   * Error state styling.
   * Use alongside an error message for accessibility.
   */
  error?: boolean;

  /**
   * Accessible label for screen readers.
   * Provide this when there's no visible label.
   */
  'aria-label'?: string;

  /**
   * Additional classes for the wrapper element.
   */
  wrapperClassName?: string;
}

/**
 * Text input with consistent styling and icon support.
 *
 * @example
 * // Basic input
 * <Input placeholder="Enter your name" />
 *
 * @example
 * // With search icon
 * <Input
 *   leftIcon={<SearchIcon />}
 *   placeholder="Search..."
 *   aria-label="Search"
 * />
 *
 * @example
 * // With error state
 * <Input
 *   error
 *   value={email}
 *   onChange={e => setEmail(e.target.value)}
 *   aria-describedby="email-error"
 * />
 * <span id="email-error">Invalid email address</span>
 *
 * @example
 * // With clear button
 * <Input
 *   value={query}
 *   onChange={e => setQuery(e.target.value)}
 *   rightIcon={
 *     query && (
 *       <button onClick={() => setQuery('')} aria-label="Clear">
 *         <XIcon />
 *       </button>
 *     )
 *   }
 * />
 *
 * @example
 * // Number input
 * <Input
 *   type="number"
 *   size="sm"
 *   min={0}
 *   max={100}
 * />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'md',
      error,
      leftIcon,
      rightIcon,
      disabled,
      className,
      wrapperClassName,
      id: providedId,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId ?? generatedId;

    return (
      <div className={cn(inputWrapperVariants({ size, error, disabled }), wrapperClassName)}>
        {leftIcon && (
          <span className={iconWrapperVariants({ size, position: 'left' })} aria-hidden="true">
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={error || undefined}
          className={cn(
            inputVariants({ size }),
            leftIcon && 'pl-0',
            rightIcon && 'pr-0',
            className
          )}
          {...props}
        />

        {rightIcon && (
          <span className={iconWrapperVariants({ size, position: 'right' })} aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
