import type { ReactNode } from 'react';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';

/**
 * Variant determines the visual size and styling of the stepper:
 * - 'compact': Small h-6 stepper for tight spaces (e.g., Sidebar grid)
 * - 'desktop': Standard h-8 stepper for desktop panels (e.g., bin inspector)
 * - 'mobile': Large h-12 touch-friendly stepper for mobile
 */
export type StepperVariant = 'compact' | 'desktop' | 'mobile';

interface StepperControlProps {
  /** Current numeric value */
  value: number;
  /** Called when value changes via input */
  onChange?: (value: number) => void;
  /** Called when stepper button is clicked, with +1 or -1 */
  onStep: (delta: number) => void;
  /** Minimum allowed value */
  min: number;
  /** Maximum allowed value */
  max: number;
  /** Step size for the input (default: 1) */
  step?: number;
  /** Visual variant */
  variant?: StepperVariant;
  /** Accessibility label for the input/display */
  ariaLabel: string;
  /**
   * If provided, shows a static display instead of an input.
   * Useful for values that should only change via steppers (like height).
   */
  displayValue?: ReactNode;
  /** Disable the entire control */
  disabled?: boolean;
  /** Additional class for the container */
  className?: string;
}

/**
 * Minus icon SVG
 */
function MinusIcon({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'w-2.5 h-2.5' : size === 'md' ? 'w-3 h-3' : 'w-5 h-5';
  const strokeWidth = size === 'lg' ? 2 : 2.5;
  return (
    <svg
      className={sizeClass}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={strokeWidth}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
    </svg>
  );
}

/**
 * Plus icon SVG
 */
function PlusIcon({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'w-2.5 h-2.5' : size === 'md' ? 'w-3 h-3' : 'w-5 h-5';
  const strokeWidth = size === 'lg' ? 2 : 2.5;
  return (
    <svg
      className={sizeClass}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={strokeWidth}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

/**
 * A reusable stepper control with +/- buttons and either an input or display.
 *
 * Supports three variants:
 * - `compact`: Small stepper for tight layouts (Sidebar drawer dimensions)
 * - `desktop`: Standard desktop stepper (bin inspector)
 * - `mobile`: Large touch-friendly stepper (mobile settings)
 *
 * @example Input mode (editable)
 * ```tsx
 * <StepperControl
 *   value={width}
 *   onChange={setWidth}
 *   onStep={(delta) => setWidth(w => w + delta * step)}
 *   min={0.5}
 *   max={50}
 *   step={0.5}
 *   variant="compact"
 *   ariaLabel="Drawer width"
 * />
 * ```
 *
 * @example Display mode (stepper-only)
 * ```tsx
 * <StepperControl
 *   value={height}
 *   onStep={(delta) => setHeight(h => h + delta)}
 *   min={1}
 *   max={50}
 *   displayValue={`${height}u`}
 *   variant="mobile"
 *   ariaLabel="Drawer height"
 * />
 * ```
 */
export function StepperControl({
  value,
  onChange,
  onStep,
  min,
  max,
  step = 1,
  variant = 'desktop',
  ariaLabel,
  displayValue,
  disabled = false,
  className = '',
}: StepperControlProps) {
  const isCompact = variant === 'compact';
  const isMobile = variant === 'mobile';
  const iconSize = isCompact ? 'sm' : isMobile ? 'lg' : 'md';

  // Determine if buttons should be disabled
  const decreaseDisabled = disabled || value <= min;
  const increaseDisabled = disabled || value >= max;

  // Button styles based on variant
  const buttonBaseClass = isMobile
    ? 'btn btn-secondary w-12 h-12 p-0'
    : isCompact
      ? 'h-full px-1 border border-stroke-subtle bg-surface-elevated text-content-tertiary hover:text-content hover:bg-surface-hover disabled:opacity-30 transition-colors'
      : 'h-full px-2 border border-stroke-subtle bg-surface-elevated text-content-tertiary hover:text-content hover:bg-surface-hover disabled:opacity-30 transition-colors';

  const decreaseButtonClass = isMobile
    ? `${buttonBaseClass} rounded-r-none`
    : `${buttonBaseClass} rounded-l border-r-0`;

  const increaseButtonClass = isMobile
    ? `${buttonBaseClass} rounded-l-none`
    : `${buttonBaseClass} rounded-r border-l-0`;

  // Container height
  const heightClass = isCompact ? 'h-6' : isMobile ? '' : 'h-8';

  // Input/display styles
  const inputClass = isMobile
    ? 'input flex-1 h-12 text-center font-semibold tabular-nums border-x-0 rounded-none'
    : isCompact
      ? 'flex-1 h-full border-y border-stroke-subtle bg-surface text-center tabular-nums text-content-secondary text-xs focus:outline-none focus:ring-1 focus:ring-accent'
      : 'flex-1 h-full border-y border-stroke-subtle bg-surface text-center tabular-nums text-content-secondary text-sm focus:outline-none focus:ring-1 focus:ring-accent';

  const displayClass = isMobile
    ? 'flex-1 h-12 flex items-center justify-center font-semibold bg-surface-elevated text-content'
    : isCompact
      ? 'flex-1 h-full flex items-center justify-center border-y border-stroke-subtle bg-surface text-center tabular-nums text-content-secondary text-xs'
      : 'flex-1 h-full flex items-center justify-center border-y border-stroke-subtle bg-surface text-center tabular-nums text-content-secondary text-sm';

  return (
    <div className={`flex items-center ${heightClass} ${className}`}>
      {/* Decrease button */}
      <button
        type="button"
        onClick={() => onStep(-1)}
        disabled={decreaseDisabled}
        className={decreaseButtonClass}
        aria-label={`Decrease ${ariaLabel}`}
      >
        <MinusIcon size={iconSize} />
      </button>

      {/* Input or display */}
      {displayValue !== undefined ? (
        <span className={displayClass} aria-label={ariaLabel}>
          {displayValue}
        </span>
      ) : onChange ? (
        <DeferredNumberInput
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
          className={inputClass}
          aria-label={ariaLabel}
        />
      ) : (
        <span className={displayClass} aria-label={ariaLabel}>
          {value}
        </span>
      )}

      {/* Increase button */}
      <button
        type="button"
        onClick={() => onStep(1)}
        disabled={increaseDisabled}
        className={increaseButtonClass}
        aria-label={`Increase ${ariaLabel}`}
      >
        <PlusIcon size={iconSize} />
      </button>
    </div>
  );
}
