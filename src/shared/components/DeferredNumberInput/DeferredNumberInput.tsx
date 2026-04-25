import { useState, useCallback } from 'react';

interface DeferredNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

/**
 * Format a number for display (show decimal only if fractional).
 * Defined outside component to avoid recreation on every render.
 */
function formatValue(val: number): string {
  return val % 1 === 0 ? String(val) : val.toFixed(1);
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
  className,
  id,
  'aria-label': ariaLabel,
}: DeferredNumberInputProps) {
  const [localValue, setLocalValue] = useState(() => formatValue(value));
  // Sync local state when external value changes (e.g., undo/redo, keyboard nudge).
  // Done during render rather than in an effect, per React docs: a conditional
  // setState in render bails out and re-runs in a single pass instead of the
  // two-render cascade an effect would produce.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setLocalValue(formatValue(value));
  }

  const commit = useCallback(() => {
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
      setLocalValue(formatValue(clamped));
    } else {
      // Invalid input - reset to current value
      setLocalValue(formatValue(value));
    }
  }, [localValue, min, max, onChange, value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setLocalValue(formatValue(value));
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
