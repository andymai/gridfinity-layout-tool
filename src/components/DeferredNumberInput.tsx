import { useState, useEffect, useCallback } from 'react';

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
  const [localValue, setLocalValue] = useState(String(value));

  // Format a number for display (show decimal only if fractional)
  const formatValue = (val: number) => val % 1 === 0 ? String(val) : val.toFixed(1);

  // Sync local state when external value changes (e.g., from undo/redo)
  // This is intentional: we need to reset local input state when the controlled value changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Legitimate sync with controlled prop
    setLocalValue(formatValue(value));
  }, [value]);

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
