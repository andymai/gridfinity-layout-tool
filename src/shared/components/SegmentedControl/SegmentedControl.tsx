/**
 * Segmented control for toggling between mutually exclusive options.
 *
 * Renders as a pill-shaped group of buttons with `aria-pressed` for
 * the active selection. Supports an optional icon per segment.
 */

import type { ReactNode } from 'react';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  /** Available options */
  options: ReadonlyArray<SegmentedOption<T>>;
  /** Currently selected value */
  value: T;
  /** Called when the selected value changes */
  onChange: (value: T) => void;
  /** Accessible label for the group */
  ariaLabel: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex gap-0.5 rounded-lg bg-surface-tertiary p-0.5"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
            value === opt.value
              ? 'bg-surface-elevated text-content shadow-sm'
              : 'text-content-tertiary hover:bg-surface-hover hover:text-content-secondary'
          }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
