/**
 * Single-select shape picker shared by feature panels (wall cutouts, handles).
 *
 * Renders the design-system segmented control: a recessed track whose selected
 * segment lifts into a raised neutral pill. Pulls its visual treatment from
 * `segmentedControlClasses` so every feature panel's shape rail reads identically.
 */

import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';

export interface ShapeOption<T extends string> {
  value: T;
  label: string;
}

interface ShapePickerProps<T extends string> {
  options: ReadonlyArray<ShapeOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function ShapePicker<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: ShapePickerProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={SEGMENT_GROUP_CLASS}>
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.value)}
            className={`flex-1 ${getSegmentClass(isActive)}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
