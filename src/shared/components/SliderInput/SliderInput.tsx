/**
 * Combined slider + editable value badge control.
 *
 * Composes the design-system Slider primitive with an inline-editable
 * value badge. Click the badge to type a precise value; it commits
 * on blur or Enter, and cancels on Escape.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Slider } from '@/design-system/Slider';
import { cn } from '@/design-system/cn';
import { interactiveTransition } from '@/design-system/variants';

interface SliderInputProps {
  /** Display label */
  label: string;
  /** Current value */
  value: number;
  /** Called when value changes */
  onChange: (value: number) => void;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Step increment (default: 1) */
  step?: number;
  /** Unit suffix shown in the badge (e.g., 'mm', 'u', '%') */
  unit?: string;
  /** Secondary info shown below the label */
  info?: string;
  /** Whether the control is disabled */
  disabled?: boolean;
}

export function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  info,
  disabled = false,
}: SliderInputProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [localDraft, setLocalDraft] = useState('');
  const skipBlurCommit = useRef(false);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitValue = useCallback(() => {
    setIsEditing(false);
    const raw = Number(localDraft);
    if (isNaN(raw) || localDraft.trim() === '') {
      return;
    }
    const clamped = Math.min(max, Math.max(min, raw));
    // Snap relative to min so values align to the step grid
    const snapped = min + Math.round((clamped - min) / step) * step;
    const final = Number(snapped.toFixed(3));
    if (final !== value) {
      onChange(final);
    }
  }, [localDraft, value, min, max, step, onChange]);

  const handleBlur = useCallback(() => {
    if (skipBlurCommit.current) {
      skipBlurCommit.current = false;
      return;
    }
    commitValue();
  }, [commitValue]);

  const startEditing = () => {
    if (disabled) return;
    setLocalDraft(String(value));
    setIsEditing(true);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      skipBlurCommit.current = true;
      commitValue();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      skipBlurCommit.current = true;
      setIsEditing(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  const infoId = `${id}-info`;
  const valueText = unit ? `${value} ${unit}` : String(value);

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      {/* Label row with editable value badge */}
      <div className="flex items-center justify-between mb-1">
        <label
          htmlFor={isEditing ? id : undefined}
          className="text-xs font-medium text-content-secondary"
        >
          {label}
        </label>

        <div className="flex items-center gap-1">
          {isEditing ? (
            <input
              ref={inputRef}
              id={id}
              type="text"
              inputMode="decimal"
              value={localDraft}
              onChange={(e) => setLocalDraft(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleInputKeyDown}
              disabled={disabled}
              className={cn(
                'w-16 rounded-md bg-surface px-2 py-0.5 text-right text-sm font-semibold tabular-nums text-content outline-none',
                'ring-2 ring-accent'
              )}
              aria-label={label}
              aria-describedby={info ? infoId : undefined}
            />
          ) : (
            <button
              id={id}
              type="button"
              onClick={startEditing}
              disabled={disabled}
              className={cn(
                'rounded-md bg-surface-secondary px-2 py-0.5 text-sm font-semibold tabular-nums text-content',
                interactiveTransition,
                !disabled && 'cursor-text hover:ring-1 hover:ring-stroke-subtle',
                disabled && 'cursor-not-allowed'
              )}
              aria-label={`${label}: ${valueText}`}
            >
              {value}
            </button>
          )}
          {unit && <span className="text-xs text-content-tertiary">{unit}</span>}
        </div>
      </div>

      {info && (
        <p id={infoId} className="mb-1 text-[10px] text-content-tertiary">
          {info}
        </p>
      )}

      <Slider
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={valueText}
        aria-describedby={info ? infoId : undefined}
      />
    </div>
  );
}
