/**
 * Combined slider + editable value badge control.
 *
 * Composes the design-system Slider primitive with an inline-editable
 * value badge. Click the badge to type a precise value; it commits
 * on blur or Enter, and cancels on Escape.
 */

import { useId, useState } from 'react';
import { Slider } from '../Slider';
import { cn } from '../cn';
import { EditableValueBadge } from './EditableValueBadge';

export interface SliderInputProps {
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
  /** Transient emphasis ring — e.g. flashed when a preset sets this value. */
  highlight?: boolean;
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
  highlight = false,
}: SliderInputProps) {
  const id = useId();
  // Mirrors the badge's edit state purely to target <label htmlFor> at the
  // input that replaces the badge while typing.
  const [isEditing, setIsEditing] = useState(false);

  const infoId = `${id}-info`;
  const valueText = unit ? `${value} ${unit}` : String(value);

  return (
    <div
      className={cn(
        'rounded-md transition-[box-shadow] duration-500',
        disabled && 'opacity-50',
        highlight && 'ring-2 ring-accent/70 ring-offset-1 ring-offset-surface'
      )}
    >
      {/* Label row with editable value badge */}
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={isEditing ? id : undefined} className="text-label text-content-secondary">
          {label}
        </label>

        <EditableValueBadge
          label={label}
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
          unit={unit}
          disabled={disabled}
          id={id}
          describedBy={info ? infoId : undefined}
          onEditingChange={setIsEditing}
        />
      </div>

      {info && (
        <p id={infoId} className="mb-1 text-micro text-content-tertiary">
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
