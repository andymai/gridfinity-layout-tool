/**
 * Combined slider + number input control for the bin designer.
 * Provides both coarse (slider drag) and fine (type a value) input.
 *
 * The number input uses "commit-on-blur" semantics: the user can freely
 * type without triggering intermediate state changes. The value is only
 * committed (clamped + snapped) on blur or Enter.
 */

import { useId, useState, useCallback } from 'react';

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
  /** Unit suffix shown after the input (e.g., 'mm', 'u', '%') */
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

  // Local draft for the number input — allows free typing without
  // triggering intermediate onChange calls (e.g. typing "12" won't
  // flash through "1" first). When not editing, the displayed value
  // derives directly from props, avoiding sync issues.
  const [localDraft, setLocalDraft] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const draft = isEditing ? localDraft : String(value);

  const commitValue = useCallback(() => {
    setIsEditing(false);
    const raw = Number(localDraft);
    if (isNaN(raw) || localDraft.trim() === '') {
      return;
    }
    const clamped = Math.min(max, Math.max(min, raw));
    const snapped = Math.round(clamped / step) * step;
    const final = Number(snapped.toFixed(3));
    if (final !== value) {
      onChange(final);
    }
  }, [localDraft, value, min, max, step, onChange]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDraft(e.target.value);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsEditing(true);
    setLocalDraft(e.target.value);
  };

  const handleInputBlur = () => {
    commitValue();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitValue();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  const infoId = `${id}-info`;
  const valueText = unit ? `${value} ${unit}` : String(value);

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={id} className="text-xs font-medium text-content-secondary">
          {label}
        </label>
        <div className="flex items-center gap-1">
          <input
            id={id}
            type="number"
            value={draft}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            className="w-14 rounded border border-stroke-subtle bg-surface px-1.5 py-0.5 text-right text-xs tabular-nums text-content focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed"
            aria-label={label}
            aria-describedby={info ? infoId : undefined}
          />
          {unit && <span className="text-xs text-content-tertiary">{unit}</span>}
        </div>
      </div>
      {info && (
        <p id={infoId} className="mb-1 text-[10px] text-content-tertiary">
          {info}
        </p>
      )}
      <input
        type="range"
        value={value}
        onChange={handleSliderChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-full h-1.5 rounded-full appearance-none bg-stroke-subtle accent-accent cursor-pointer disabled:cursor-not-allowed py-2"
        aria-label={`${label} slider`}
        aria-valuetext={valueText}
        aria-describedby={info ? infoId : undefined}
      />
    </div>
  );
}
