/**
 * One overhang/taper value row.
 *
 * Desktop packs label, track and value onto a single line — the section carries
 * up to nine sliders, and the stacked two-line form pushed the taper controls
 * off-screen. Touch keeps the stacked `SliderInput`, whose full-width track
 * clears the 36px secondary touch target that the ~84px inline track does not.
 */

import { useId, useState } from 'react';
import { EditableValueBadge, Slider, SliderInput } from '@/design-system';

export interface OverhangSliderRowProps {
  label: string;
  /**
   * Accessible name, when the visible label alone would be ambiguous. The taper
   * repeats the overhang's four side names, so without this a screen reader
   * hears "Right" twice in one section with no way to tell them apart.
   */
  srLabel?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** Stack the label above a full-width track (touch). */
  stacked: boolean;
}

export function OverhangSliderRow({
  label,
  srLabel,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  stacked,
}: OverhangSliderRowProps) {
  const id = useId();
  const [isEditing, setIsEditing] = useState(false);
  const a11yLabel = srLabel ?? label;

  if (stacked) {
    // SliderInput's label is both visible and accessible name, so the stacked
    // rows lean on the labelled group around them for their disambiguation.
    return (
      <SliderInput
        label={label}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        unit={unit}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={isEditing ? id : undefined}
        title={label}
        className="min-w-0 flex-1 truncate text-xs font-medium text-content-secondary"
      >
        {label}
      </label>
      <Slider
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        aria-label={a11yLabel}
        aria-valuetext={`${value} ${unit}`}
        className="w-[5.25rem] shrink-0"
      />
      {/* Fixed width, right-aligned: values range from `0` to `42` across the
          section, which would otherwise shove every track to a different x and
          leave the column ragged. `nowrap` keeps a near-miss from silently
          wrapping the badge instead. */}
      <div className="flex w-16 shrink-0 justify-end whitespace-nowrap">
        <EditableValueBadge
          label={a11yLabel}
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
          unit={unit}
          id={id}
          onEditingChange={setIsEditing}
        />
      </div>
    </div>
  );
}
