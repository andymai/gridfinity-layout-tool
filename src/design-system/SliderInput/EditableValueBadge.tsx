/**
 * Click-to-type value badge — the numeric half of `SliderInput`.
 *
 * Split out so a caller can compose its own slider layout (e.g. a one-line
 * row) without re-implementing the commit/clamp/snap/Escape behaviour.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../cn';
import { interactiveTransition } from '../variants';

export interface EditableValueBadgeProps {
  /** Accessible name; combined with the value for the button's label. */
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  /** Unit suffix rendered beside the badge (e.g. 'mm'). */
  unit?: string;
  disabled?: boolean;
  /** Shared with the caller's <label htmlFor>, so it can focus the input. */
  id?: string;
  describedBy?: string;
  /**
   * Replaces the badge text while leaving editing bound to `value` — lets a
   * caller show context such as a cap ("21 of 21") without a second control.
   */
  display?: string;
  /** Fires on entering/leaving edit mode, so a caller can target its <label htmlFor>. */
  onEditingChange?: (isEditing: boolean) => void;
}

export function EditableValueBadge({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  disabled = false,
  id,
  describedBy,
  display,
  onEditingChange,
}: EditableValueBadgeProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditingState] = useState(false);
  const [localDraft, setLocalDraft] = useState('');
  const skipBlurCommit = useRef(false);

  const setIsEditing = useCallback(
    (editing: boolean) => {
      setIsEditingState(editing);
      onEditingChange?.(editing);
    },
    [onEditingChange]
  );

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
  }, [localDraft, value, min, max, step, onChange, setIsEditing]);

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

  const valueText = unit ? `${value} ${unit}` : String(value);

  return (
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
            'w-16 rounded-md bg-surface px-2 py-0.5 text-right text-value tabular-nums text-content outline-none',
            'ring-2 ring-accent'
          )}
          aria-label={label}
          aria-describedby={describedBy}
        />
      ) : (
        <button
          id={id}
          type="button"
          onClick={startEditing}
          disabled={disabled}
          className={cn(
            'rounded-md bg-surface-secondary px-2 py-0.5 text-value tabular-nums text-content',
            interactiveTransition,
            !disabled && 'cursor-text hover:ring-1 hover:ring-stroke-subtle',
            disabled && 'cursor-not-allowed'
          )}
          aria-label={`${label}: ${valueText}`}
        >
          {display ?? value}
        </button>
      )}
      {unit && <span className="text-xs text-content-tertiary">{unit}</span>}
    </div>
  );
}
