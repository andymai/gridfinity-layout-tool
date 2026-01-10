import { useState, useEffect, useCallback } from 'react';

interface DeferredNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  id?: string;
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
}: DeferredNumberInputProps) {
  const [localValue, setLocalValue] = useState(String(value));

  // Sync local state when external value changes (e.g., from undo/redo)
  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const commit = useCallback(() => {
    const parsed = parseInt(localValue, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
      setLocalValue(String(clamped));
    } else {
      // Invalid input - reset to current value
      setLocalValue(String(value));
    }
  }, [localValue, min, max, onChange, value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setLocalValue(String(value));
      e.currentTarget.blur();
    }
  };

  return (
    <input
      id={id}
      type="number"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      min={min}
      max={max}
      step={step}
      className={className}
    />
  );
}
