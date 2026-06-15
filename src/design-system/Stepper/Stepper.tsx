import { forwardRef, useId, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';
import { PlusIcon, MinusIcon } from '../Icon';
import { focusRing, disabledStyles, interactiveTransition } from '../variants';

/** Idle window for coalescing step clicks in `'deferred'` commit mode. */
export const DEFERRED_COMMIT_DELAY_MS = 250;
const containerVariants = cva([], {
  variants: {
    orientation: {
      horizontal: 'items-center',
      vertical: 'inline-flex flex-col items-stretch',
    },
    size: {
      sm: '',
      md: '',
      lg: '',
    },
    fullWidth: {
      true: '',
      false: '',
    },
  },
  compoundVariants: [
    // Horizontal lays the whole control out as one fixed-height row; the
    // input/display carries `flex-1`, so the middle element absorbs extra width
    // while the buttons stay fixed. Vertical stacks three fixed-height cells, so
    // the container takes no overall height of its own.
    { orientation: 'horizontal', size: 'sm', class: 'h-6' },
    { orientation: 'horizontal', size: 'md', class: 'h-8' },
    { orientation: 'horizontal', size: 'lg', class: 'h-12' },
    { orientation: 'horizontal', fullWidth: true, class: 'flex w-full' },
    { orientation: 'horizontal', fullWidth: false, class: 'inline-flex' },
    // Vertical is a slim side control. A number input defaults to ~20ch of
    // intrinsic width, and the cells use `w-full` (not flex-1), so without an
    // explicit container width that preferred width inflates the column. Pin it.
    { orientation: 'vertical', size: 'sm', class: 'w-8' },
    { orientation: 'vertical', size: 'md', class: 'w-10' },
    { orientation: 'vertical', size: 'lg', class: 'w-12' },
  ],
  defaultVariants: {
    orientation: 'horizontal',
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
        top: 'w-full rounded-t-md rounded-b-none border-b-0',
        bottom: 'w-full rounded-b-md rounded-t-none border-t-0',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const inputVariants = cva(
  [
    'bg-surface',
    'text-center',
    'tabular-nums',
    'outline-none',
    // Hide the native number-input spin buttons — the Stepper has its own +/-
    // buttons, and the native arrows add width and visual clutter.
    '[appearance:textfield]',
    '[&::-webkit-inner-spin-button]:appearance-none',
    '[&::-webkit-outer-spin-button]:appearance-none',
    interactiveTransition,
    ...focusRing,
    ...disabledStyles,
  ],
  {
    variants: {
      orientation: {
        horizontal: 'flex-1 h-full border-y border-stroke-subtle',
        vertical: 'w-full border-x border-stroke-subtle',
      },
      // Width floors live in compoundVariants per orientation: horizontal needs
      // room for the value between the buttons; vertical is a slim side control,
      // so it gets a tighter floor (just enough for the mm value).
      size: {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base font-semibold border-stroke',
      },
    },
    compoundVariants: [
      { orientation: 'horizontal', size: 'sm', class: 'min-w-[34px]' },
      { orientation: 'horizontal', size: 'md', class: 'min-w-[38px]' },
      { orientation: 'horizontal', size: 'lg', class: 'min-w-[48px]' },
      { orientation: 'vertical', size: 'sm', class: 'h-6 min-w-[28px]' },
      { orientation: 'vertical', size: 'md', class: 'h-8 min-w-[32px]' },
      { orientation: 'vertical', size: 'lg', class: 'h-12 min-w-[40px]' },
    ],
    defaultVariants: {
      orientation: 'horizontal',
      size: 'md',
    },
  }
);

const displayVariants = cva(
  ['flex items-center justify-center', 'bg-surface', 'tabular-nums', 'select-none'],
  {
    variants: {
      orientation: {
        horizontal: 'flex-1 h-full border-y border-stroke-subtle',
        vertical: 'w-full border-x border-stroke-subtle',
      },
      size: {
        sm: 'text-xs text-content-secondary',
        md: 'text-sm text-content-secondary',
        lg: 'text-base font-semibold text-content border-stroke',
      },
    },
    compoundVariants: [
      { orientation: 'horizontal', size: 'sm', class: 'min-w-[34px]' },
      { orientation: 'horizontal', size: 'md', class: 'min-w-[38px]' },
      { orientation: 'horizontal', size: 'lg', class: 'min-w-[48px]' },
      { orientation: 'vertical', size: 'sm', class: 'h-6 min-w-[28px]' },
      { orientation: 'vertical', size: 'md', class: 'h-8 min-w-[32px]' },
      { orientation: 'vertical', size: 'lg', class: 'h-12 min-w-[40px]' },
    ],
    defaultVariants: {
      orientation: 'horizontal',
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
    // Round to `decimals` then strip trailing zeros so 5.5 stays "5.5" (not
    // "5.50") even when two decimals of precision are allowed.
    (val: number): string => String(Number(val.toFixed(decimals))),
    [decimals]
  );

  const [localValue, setLocalValue] = useState(() => fmt(externalValue));
  // Enter/Escape blur the input programmatically after already committing or
  // reverting; this ref tells the resulting onBlur to skip a second commit.
  const skipBlurCommitRef = useRef(false);
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
      skipBlurCommitRef.current = true;
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setLocalValue(fmt(externalValue));
      skipBlurCommitRef.current = true;
      e.currentTarget.blur();
    }
  };

  const handleBlur = () => {
    // Enter/Escape already committed or reverted before blurring — don't repeat it.
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
      return;
    }
    commit();
  };

  return {
    value: localValue,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setLocalValue(e.target.value),
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(),
    onBlur: handleBlur,
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
   * Layout direction. `'vertical'` stacks [+] / value / [−] for spatial controls
   * (e.g. edge padding flanking a schematic). `'horizontal'` is [−] value [+].
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical' | null;

  /**
   * Stretch the control to fill its container instead of hugging its content.
   * The +/- buttons keep their fixed width; the input/display absorbs the slack.
   * Horizontal only.
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
   * Optional id applied to the inner input, so a caller can render an associated
   * `<label htmlFor={id}>`. Falls back to a generated id.
   */
  id?: string;

  /**
   * Accessible label for the decrease button.
   * @default `Decrease ${ariaLabel}`
   */
  decreaseLabel?: string;

  /**
   * Accessible label for the increase button.
   * @default `Increase ${ariaLabel}`
   */
  increaseLabel?: string;

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
 * // Vertical (spatial padding control)
 * <Stepper
 *   orientation="vertical"
 *   value={padding}
 *   onChange={setPadding}
 *   onStep={(delta) => setPadding(p => p + delta * 0.25)}
 *   min={0}
 *   max={100}
 *   aria-label="Left padding"
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
      orientation = 'horizontal',
      fullWidth = false,
      displayValue,
      'aria-label': ariaLabel,
      decreaseLabel,
      increaseLabel,
      disabled = false,
      commitMode = 'immediate',
      className,
      id,
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const isVertical = orientation === 'vertical';

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

    // 12px is the smallest a stroked +/- glyph renders crisply — a 10px glyph
    // lands on sub-pixel boundaries and reads blurry — so `sm` shares the `md`
    // icon size rather than scaling down.
    const iconConfig = {
      sm: { className: 'w-3 h-3', strokeWidth: 2.5 },
      md: { className: 'w-3 h-3', strokeWidth: 2.5 },
      lg: { className: 'w-5 h-5', strokeWidth: 2 },
    }[size ?? 'md'];

    const showInput = displayValue === undefined && onChange;

    const decreaseButton = (
      <button
        type="button"
        onClick={() => handleStep(-1)}
        disabled={isDecreaseDisabled}
        className={buttonVariants({ size, position: isVertical ? 'bottom' : 'left' })}
        aria-label={decreaseLabel ?? `Decrease ${ariaLabel}`}
      >
        <MinusIcon
          size="sm"
          className={iconConfig.className}
          strokeWidth={iconConfig.strokeWidth}
        />
      </button>
    );

    const increaseButton = (
      <button
        type="button"
        onClick={() => handleStep(1)}
        disabled={isIncreaseDisabled}
        className={buttonVariants({ size, position: isVertical ? 'top' : 'right' })}
        aria-label={increaseLabel ?? `Increase ${ariaLabel}`}
      >
        <PlusIcon size="sm" className={iconConfig.className} strokeWidth={iconConfig.strokeWidth} />
      </button>
    );

    const middle = showInput ? (
      <input
        id={inputId}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        className={inputVariants({ orientation, size })}
        aria-label={ariaLabel}
        {...deferredInput}
      />
    ) : (
      <span className={displayVariants({ orientation, size })} aria-label={ariaLabel}>
        {displayValue ?? optimisticValue}
      </span>
    );

    return (
      <div ref={ref} className={cn(containerVariants({ orientation, size, fullWidth }), className)}>
        {isVertical ? (
          <>
            {increaseButton}
            {middle}
            {decreaseButton}
          </>
        ) : (
          <>
            {decreaseButton}
            {middle}
            {increaseButton}
          </>
        )}
      </div>
    );
  }
);

Stepper.displayName = 'Stepper';
