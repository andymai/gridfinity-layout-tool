import { forwardRef, useId, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';
import { PlusIcon, MinusIcon } from '../Icon';
import { focusRing, disabledStyles, interactiveTransition } from '../variants';

/** Idle window for coalescing step clicks in `'deferred'` commit mode. */
export const DEFERRED_COMMIT_DELAY_MS = 250;
const containerVariants = cva(['items-center'], {
  variants: {
    size: {
      sm: 'h-6',
      md: 'h-8',
      lg: 'h-12',
    },
    fullWidth: {
      // The input/display carries `flex-1`, so stretching the container lets the
      // middle element absorb the extra width while the buttons stay fixed.
      true: 'flex w-full',
      false: 'inline-flex',
    },
  },
  defaultVariants: {
    size: 'md',
    fullWidth: false,
  },
});

const buttonVariants = cva(
  [
    'flex items-center justify-center',
    'bg-surface-elevated',
    'border border-stroke-subtle',
    'text-content-tertiary',
    'hover:text-content hover:bg-surface-hover',
    interactiveTransition,
    ...focusRing,
    ...disabledStyles,
  ],
  {
    variants: {
      size: {
        sm: 'h-6 px-1',
        md: 'h-8 px-2',
        lg: [
          'w-12 h-12 px-3',
          'bg-gradient-to-b from-surface-hover to-surface-elevated',
          'border-stroke text-content shadow-sm',
          '[box-shadow:var(--shadow-sm),inset_0_1px_0_rgba(255,255,255,0.03)]',
        ].join(' '),
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
        sm: 'text-xs min-w-[34px]',
        md: 'text-sm min-w-[38px]',
        lg: 'text-base font-semibold min-w-[48px] border-stroke',
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
        sm: 'text-xs text-content-secondary min-w-[34px]',
        md: 'text-sm text-content-secondary min-w-[38px]',
        lg: 'text-base font-semibold text-content min-w-[48px] border-stroke',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

type StepperVariantProps = VariantProps<typeof containerVariants>;

// Deferred Input Hook

/**
 * Deferred number input — lets users fully clear and retype a value without
 * onChange firing until blur or Enter. Clamps to [min, max] on commit but does
 * NOT snap to `step`, so off-grid entries (e.g. a 0.25mm tolerance) survive.
 */
function useDeferredNumberInput(
  externalValue: number,
  onChange: ((value: number) => void) | undefined,
  min: number,
  max: number,
  decimals: number
) {
  const fmt = useCallback(
    (val: number): string => (val % 1 === 0 ? String(val) : val.toFixed(decimals)),
    [decimals]
  );

  const [localValue, setLocalValue] = useState(() => fmt(externalValue));
  // Resync on external change (undo/redo, stepper buttons) during render rather
  // than in an effect: a guarded setState in render bails out and re-runs in a
  // single pass instead of the two-render cascade an effect would produce.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // Only resync in input mode: when onChange is absent the input isn't rendered,
  // so a render-time setState there would just burn an extra pass for nothing.
  const [lastSynced, setLastSynced] = useState(externalValue);
  if (onChange && externalValue !== lastSynced) {
    setLastSynced(externalValue);
    setLocalValue(fmt(externalValue));
  }

  const commit = useCallback(() => {
    if (!onChange) return;
    // Skip when text is unchanged so focus+blur on an out-of-range value doesn't
    // silently clamp it and emit an undo entry — data stays put until edited.
    if (localValue === fmt(externalValue)) return;

    const parsed = parseFloat(localValue);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
      setLocalValue(fmt(clamped));
    } else {
      setLocalValue(fmt(externalValue));
    }
  }, [localValue, min, max, onChange, externalValue, fmt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setLocalValue(fmt(externalValue));
      e.currentTarget.blur();
    }
  };

  return {
    value: localValue,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setLocalValue(e.target.value),
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(),
    onBlur: commit,
    onKeyDown: handleKeyDown,
  };
}

// Stepper Component

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
   * Decimal places used to render fractional values in the input.
   * @default 1
   */
  inputDecimals?: number;

  /**
   * Controls when step-button clicks flow through to `onStep`:
   * - `'immediate'` (default): every click calls `onStep` synchronously.
   * - `'deferred'`: clicks accumulate locally for {@link DEFERRED_COMMIT_DELAY_MS}
   *   before flushing as a single `onStep(totalDelta)`. Use for heavy params
   *   where each click triggers a slow regeneration.
   * @default 'immediate'
   */
  commitMode?: 'immediate' | 'deferred';

  /**
   * Stretch the control to fill its container instead of hugging its content.
   * The +/- buttons keep their fixed width; the input/display absorbs the slack.
   * @default false
   */
  fullWidth?: boolean | null;

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
      inputDecimals = 1,
      size = 'md',
      fullWidth = false,
      displayValue,
      'aria-label': ariaLabel,
      disabled = false,
      commitMode = 'immediate',
      className,
    },
    ref
  ) => {
    const inputId = useId();

    // Deferred commit accumulates +/- clicks into `pendingDelta` and flushes it
    // as a single onStep after a short idle. The UI shows the optimistic value
    // so the user gets feedback while an expensive downstream regen is held off.
    const [pendingDelta, setPendingDelta] = useState(0);
    const [lastSeenValue, setLastSeenValue] = useState(value);
    const onStepRef = useRef(onStep);
    useEffect(() => {
      onStepRef.current = onStep;
    }, [onStep]);

    // External value updates (commit landed, undo/redo) invalidate the
    // optimistic delta. Reset during render per React's "adjust state on prop
    // change" pattern; the `if` guard prevents an infinite loop.
    if (value !== lastSeenValue) {
      setLastSeenValue(value);
      if (pendingDelta !== 0) setPendingDelta(0);
    }

    useEffect(() => {
      if (commitMode !== 'deferred' || pendingDelta === 0) return;
      const timer = setTimeout(() => {
        onStepRef.current(pendingDelta);
        setPendingDelta(0);
      }, DEFERRED_COMMIT_DELAY_MS);
      return () => clearTimeout(timer);
    }, [commitMode, pendingDelta]);

    const handleStep = (delta: number) => {
      if (commitMode === 'immediate') onStep(delta);
      else setPendingDelta((prev) => prev + delta);
    };

    // Optimistic value for display, clamped so a pending deferred commit can't
    // visually overshoot the bounds.
    const optimisticValue =
      commitMode === 'deferred' && pendingDelta !== 0
        ? Math.max(min, Math.min(max, value + pendingDelta * step))
        : value;

    const deferredInput = useDeferredNumberInput(
      optimisticValue,
      onChange,
      min,
      max,
      inputDecimals
    );

    const isDecreaseDisabled = disabled || optimisticValue <= min;
    const isIncreaseDisabled = disabled || optimisticValue >= max;

    const iconConfig = {
      sm: { className: 'w-2.5 h-2.5', strokeWidth: 2.5 },
      md: { className: 'w-3 h-3', strokeWidth: 2.5 },
      lg: { className: 'w-5 h-5', strokeWidth: 2 },
    }[size ?? 'md'];

    const showInput = displayValue === undefined && onChange;

    return (
      <div ref={ref} className={cn(containerVariants({ size, fullWidth }), className)}>
        {/* Decrease button */}
        <button
          type="button"
          onClick={() => handleStep(-1)}
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
            type="number"
            inputMode="decimal"
            step={step}
            min={min}
            max={max}
            disabled={disabled}
            className={inputVariants({ size })}
            aria-label={ariaLabel}
            {...deferredInput}
          />
        ) : (
          <span className={displayVariants({ size })} aria-label={ariaLabel}>
            {displayValue ?? optimisticValue}
          </span>
        )}

        {/* Increase button */}
        <button
          type="button"
          onClick={() => handleStep(1)}
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
