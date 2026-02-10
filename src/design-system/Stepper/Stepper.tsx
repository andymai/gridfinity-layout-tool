import { forwardRef, useId, useState, useCallback, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';
import { PlusIcon, MinusIcon } from '../Icon';
import { focusRing, disabledStyles, interactiveTransition } from '../variants';

// ─────────────────────────────────────────────────────────────────────────────
// Variants
// ─────────────────────────────────────────────────────────────────────────────

const containerVariants = cva(['inline-flex items-center'], {
  variants: {
    size: {
      sm: 'h-6',
      md: 'h-8',
      lg: 'h-12',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const buttonVariants = cva(
  [
    'flex items-center justify-center',
    'bg-surface-elevated',
    'border border-stroke-subtle',
    'text-content-tertiary',
    'hover:text-content hover:bg-surface-hover',
    'disabled:opacity-30',
    interactiveTransition,
    ...focusRing,
    ...disabledStyles,
  ],
  {
    variants: {
      size: {
        sm: 'h-6 px-1',
        md: 'h-8 px-2',
        lg: 'w-12 h-12 px-3 bg-gradient-to-b from-surface-hover to-surface-elevated',
      },
      position: {
        left: 'rounded-l-md rounded-r-none border-r-0',
        right: 'rounded-r-md rounded-l-none border-l-0',
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
    'h-full',
    'bg-surface',
    'border-y border-stroke-subtle',
    'text-center',
    'tabular-nums',
    'outline-none',
    interactiveTransition,
    ...focusRing,
    ...disabledStyles,
  ],
  {
    variants: {
      size: {
        sm: 'text-xs min-w-[40px]',
        md: 'text-sm min-w-[48px]',
        lg: 'text-base font-semibold min-w-[64px]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const displayVariants = cva(
  [
    'flex items-center justify-center',
    'flex-1',
    'h-full',
    'bg-surface',
    'border-y border-stroke-subtle',
    'tabular-nums',
    'select-none',
  ],
  {
    variants: {
      size: {
        sm: 'text-xs text-content-secondary min-w-[40px]',
        md: 'text-sm text-content-secondary min-w-[48px]',
        lg: 'text-base font-semibold text-content min-w-[64px]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

type StepperVariantProps = VariantProps<typeof containerVariants>;

// ─────────────────────────────────────────────────────────────────────────────
// Deferred Input Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for deferred number input - allows users to clear and retype
 * without triggering onChange until blur or Enter.
 *
 * Uses computed display value during render (no effects) to avoid
 * React anti-patterns with setState in useEffect.
 */
function useDeferredValue(
  externalValue: number,
  onChange: ((value: number) => void) | undefined,
  min: number,
  max: number,
  step: number
) {
  // localValue only stores user's typed input while focused
  const [localValue, setLocalValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Compute display value during render - no effect needed
  const displayValue = isFocused ? localValue : formatNumber(externalValue);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleFocus = () => {
    // Initialize local value with current external value when focusing
    setLocalValue(formatNumber(externalValue));
    setIsFocused(true);
  };

  const commit = useCallback(() => {
    setIsFocused(false);
    if (!onChange) return;

    const parsed = parseFloat(localValue);
    if (isNaN(parsed)) {
      // Invalid input - just unfocus, displayValue will show externalValue
      return;
    }

    // Clamp and snap to step
    const snapped = Math.round(parsed / step) * step;
    const clamped = Math.max(min, Math.min(max, snapped));

    onChange(clamped);
  }, [localValue, onChange, min, max, step]);

  const handleBlur = () => {
    commit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commit();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      // Cancel edit - unfocus and displayValue will revert to externalValue
      setIsFocused(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  return {
    value: displayValue,
    onChange: handleChange,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
  };
}

function formatNumber(n: number): string {
  // Show decimals only if fractional
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Stepper Component
// ─────────────────────────────────────────────────────────────────────────────

export interface StepperProps extends StepperVariantProps {
  /**
   * Current numeric value.
   */
  value: number;

  /**
   * Called when value changes via the input field.
   * If omitted, the input is disabled (use displayValue instead).
   */
  onChange?: (value: number) => void;

  /**
   * Called when a stepper button is clicked.
   * Receives +1 or -1 as the delta.
   */
  onStep: (delta: number) => void;

  /**
   * Minimum allowed value.
   */
  min: number;

  /**
   * Maximum allowed value.
   */
  max: number;

  /**
   * Step increment for the input.
   * @default 1
   */
  step?: number;

  /**
   * If provided, shows a static display instead of an input.
   * Useful for values that should only change via steppers.
   *
   * @example "3u" for height units
   */
  displayValue?: ReactNode;

  /**
   * Accessibility label for the stepper.
   */
  'aria-label': string;

  /**
   * Disable the entire control.
   */
  disabled?: boolean;

  /**
   * Additional CSS classes.
   */
  className?: string;
}

/**
 * Numeric stepper with +/- buttons and optional input.
 *
 * Supports two modes:
 * - **Input mode**: Editable number input between the buttons
 * - **Display mode**: Static display (when `displayValue` is provided)
 *
 * @example
 * // Input mode (editable)
 * <Stepper
 *   value={width}
 *   onChange={setWidth}
 *   onStep={(delta) => setWidth(w => w + delta * 0.5)}
 *   min={0.5}
 *   max={50}
 *   step={0.5}
 *   aria-label="Width"
 * />
 *
 * @example
 * // Display mode (stepper-only, shows "3u")
 * <Stepper
 *   value={height}
 *   onStep={(delta) => setHeight(h => h + delta)}
 *   min={1}
 *   max={10}
 *   displayValue={`${height}u`}
 *   aria-label="Height"
 * />
 *
 * @example
 * // Large touch-friendly stepper
 * <Stepper
 *   size="lg"
 *   value={quantity}
 *   onStep={(delta) => setQuantity(q => q + delta)}
 *   min={1}
 *   max={100}
 *   displayValue={quantity}
 *   aria-label="Quantity"
 * />
 */
export const Stepper = forwardRef<HTMLDivElement, StepperProps>(
  (
    {
      value,
      onChange,
      onStep,
      min,
      max,
      step = 1,
      size = 'md',
      displayValue,
      'aria-label': ariaLabel,
      disabled = false,
      className,
    },
    ref
  ) => {
    const inputId = useId();

    const deferredInput = useDeferredValue(value, onChange, min, max, step);

    const isDecreaseDisabled = disabled || value <= min;
    const isIncreaseDisabled = disabled || value >= max;

    const iconConfig = {
      sm: { className: 'w-2.5 h-2.5', strokeWidth: 2.5 },
      md: { className: 'w-3 h-3', strokeWidth: 2.5 },
      lg: { className: 'w-5 h-5', strokeWidth: 2 },
    }[size ?? 'md'];

    const showInput = displayValue === undefined && onChange;

    return (
      <div ref={ref} className={cn(containerVariants({ size }), className)}>
        {/* Decrease button */}
        <button
          type="button"
          onClick={() => onStep(-1)}
          disabled={isDecreaseDisabled}
          className={buttonVariants({ size, position: 'left' })}
          aria-label={`Decrease ${ariaLabel}`}
        >
          <MinusIcon
            size="sm"
            className={iconConfig.className}
            strokeWidth={iconConfig.strokeWidth}
          />
        </button>

        {/* Input or display */}
        {showInput ? (
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            className={inputVariants({ size })}
            aria-label={ariaLabel}
            {...deferredInput}
          />
        ) : (
          <span className={displayVariants({ size })} aria-label={ariaLabel}>
            {displayValue ?? value}
          </span>
        )}

        {/* Increase button */}
        <button
          type="button"
          onClick={() => onStep(1)}
          disabled={isIncreaseDisabled}
          className={buttonVariants({ size, position: 'right' })}
          aria-label={`Increase ${ariaLabel}`}
        >
          <PlusIcon
            size="sm"
            className={iconConfig.className}
            strokeWidth={iconConfig.strokeWidth}
          />
        </button>
      </div>
    );
  }
);

Stepper.displayName = 'Stepper';
