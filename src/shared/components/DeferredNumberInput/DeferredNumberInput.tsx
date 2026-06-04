import { useState, useCallback } from 'react';

interface DeferredNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decimal places used to render fractional values (default 1). */
  decimals?: number;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

/**
 * Number input that defers updates until blur or Enter.
 * Allows users to fully clear and retype values without immediate validation snapping.
 */
export function DeferredNumberInput({
  value,
  onChange,
  min = 1,
  max = Infinity,
  step,
  decimals = 1,
  className,
  id,
  'aria-label': ariaLabel,
}: DeferredNumberInputProps) {
  // Show integers bare; render fractions at the caller's precision so typed
  // off-grid values (e.g. a 0.25mm tolerance) aren't rounded away on display.
  const fmt = useCallback(
    (val: number): string => (val % 1 === 0 ? String(val) : val.toFixed(decimals)),
    [decimals]
  );

  const [localValue, setLocalValue] = useState(() => fmt(value));
  // Sync local state when external value changes (e.g., undo/redo, keyboard nudge).
  // Done during render rather than in an effect, per React docs: a conditional
  // setState in render bails out and re-runs in a single pass instead of the
  // two-render cascade an effect would produce.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setLocalValue(fmt(value));
  }

  const commit = useCallback(() => {
    // Skip when text is unchanged so focus+blur on a value that's now out of
    // the min/max range doesn't silently clamp it and emit an undo entry —
    // persisted data stays put until the user actually edits.
    if (localValue === fmt(value)) return;

    const parsed = parseFloat(localValue);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
      setLocalValue(fmt(clamped));
    } else {
      // Invalid input - reset to current value
      setLocalValue(fmt(value));
    }
  }, [localValue, min, max, onChange, value, fmt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setLocalValue(fmt(value));
      e.currentTarget.blur();
    }
  };

  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      min={min}
      max={max}
      step={step}
      className={className}
      aria-label={ariaLabel}
    />
  );
}
