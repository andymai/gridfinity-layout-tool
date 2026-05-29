/**
 * Segmented button selector for wall thickness values.
 *
 * Shows discrete options that are multiples of common FDM nozzle sizes
 * (0.4mm, 0.6mm, 0.8mm).
 */

import { useCallback, useRef } from 'react';
import { WALL_THICKNESS_OPTIONS } from '@/features/bin-designer/constants';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';

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
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      const currentIndex = WALL_THICKNESS_OPTIONS.findIndex((o) => Math.abs(o - value) < 0.001);
      let nextIndex: number;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % WALL_THICKNESS_OPTIONS.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex =
          (currentIndex - 1 + WALL_THICKNESS_OPTIONS.length) % WALL_THICKNESS_OPTIONS.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = WALL_THICKNESS_OPTIONS.length - 1;
      } else {
        return;
      }

      onChange(WALL_THICKNESS_OPTIONS[nextIndex]);
      // Move focus to the newly selected button
      const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      buttons?.[nextIndex]?.focus();
    },
    [value, onChange, disabled]
  );

  return (
    <div>
      <div className={`mb-2 flex items-center justify-between ${disabled ? 'opacity-50' : ''}`}>
        <span className="text-xs font-medium text-content-secondary">{label}</span>
        <span className="text-xs tabular-nums text-content-tertiary">{value} mm</span>
      </div>
      <div
        ref={groupRef}
        className={SEGMENT_GROUP_CLASS}
        role="radiogroup"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {WALL_THICKNESS_OPTIONS.map((option) => {
          const isActive = Math.abs(option - value) < 0.001;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              tabIndex={isActive ? 0 : -1}
              aria-checked={isActive}
              aria-label={`${option}mm`}
              disabled={disabled}
              onClick={() => onChange(option)}
              className={`flex-1 tabular-nums ${getSegmentClass(isActive)}`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
