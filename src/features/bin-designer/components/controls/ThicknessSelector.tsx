/**
 * Segmented button selector for wall thickness values.
 *
 * Shows discrete options that are multiples of common FDM nozzle sizes
 * (0.4mm, 0.6mm, 0.8mm).
 */

import { WALL_THICKNESS_OPTIONS } from '@/features/bin-designer/constants';

interface ThicknessSelectorProps {
  /** Display label */
  label: string;
  /** Current value in mm */
  value: number;
  /** Called when value changes */
  onChange: (value: number) => void;
  /** Whether the control is disabled */
  disabled?: boolean;
}

export function ThicknessSelector({
  label,
  value,
  onChange,
  disabled = false,
}: ThicknessSelectorProps) {
  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-content-secondary">{label}</span>
        <span className="text-xs tabular-nums text-content-tertiary">{value} mm</span>
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {WALL_THICKNESS_OPTIONS.map((option) => {
          const isActive = Math.abs(option - value) < 0.001;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={`${option}mm`}
              disabled={disabled}
              onClick={() => onChange(option)}
              className={`flex-1 rounded-md px-1 py-1.5 text-xs font-medium tabular-nums transition-colors ${
                isActive
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-surface-secondary text-content-secondary hover:bg-surface-tertiary'
              } disabled:cursor-not-allowed`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
