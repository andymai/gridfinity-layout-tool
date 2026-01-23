/**
 * Combined slider + number input control for the bin designer.
 * Provides both coarse (slider drag) and fine (type a value) input.
 */

import { useId } from 'react';

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

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Number(e.target.value);
    if (!isNaN(raw)) {
      const clamped = Math.min(max, Math.max(min, raw));
      // Round to step precision
      const snapped = Math.round(clamped / step) * step;
      onChange(Number(snapped.toFixed(3)));
    }
  };

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
            value={value}
            onChange={handleInputChange}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            className="w-14 rounded border border-stroke-subtle bg-surface px-1.5 py-0.5 text-right text-xs tabular-nums text-content focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed"
            aria-label={label}
          />
          {unit && (
            <span className="text-xs text-content-tertiary">{unit}</span>
          )}
        </div>
      </div>
      {info && (
        <p className="mb-1 text-[10px] text-content-tertiary">{info}</p>
      )}
      <input
        type="range"
        value={value}
        onChange={handleSliderChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-full h-1.5 rounded-full appearance-none bg-stroke-subtle accent-accent cursor-pointer disabled:cursor-not-allowed"
        aria-label={`${label} slider`}
      />
    </div>
  );
}
