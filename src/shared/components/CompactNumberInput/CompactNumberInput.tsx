/**
 * Figma-style compact, number-first input.
 *
 * Number is primary: click the value to type an exact number, drag the label
 * to scrub coarsely, or use arrow keys to nudge. Modifiers apply to both scrub
 * and arrows — Shift = ×10 step, Alt = fine (÷10) step. Enter commits, Escape
 * reverts.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/design-system/cn';

interface CompactNumberInputProps {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly unit?: string;
  readonly disabled?: boolean;
  /** Tooltip hint surfaced on hover/focus (the slider's inline `info`, compacted). */
  readonly info?: string;
  /** Transient emphasis ring — flashed when a preset sets this value. */
  readonly highlight?: boolean;
  /** Selected items have differing values — show a "mixed" placeholder until edited. */
  readonly indeterminate?: boolean;
}

/** Placeholder glyph shown when a multi-selection has mixed values (en dash). */
const MIXED_GLYPH = '–';

/** Pixels of horizontal drag per step increment while scrubbing. */
const PIXELS_PER_STEP = 6;
/** Movement past this (px) turns a label press into a scrub instead of a click. */
const SCRUB_THRESHOLD = 3;

/** Step size for the current modifier keys: Shift = ×10, Alt = fine (÷10). */
function effectiveStep(step: number, e: { shiftKey: boolean; altKey: boolean }): number {
  if (e.shiftKey) return step * 10;
  if (e.altKey) return step / 10;
  return step;
}

export function CompactNumberInput({
  label,
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 0.5,
  unit,
  disabled = false,
  info,
  highlight = false,
  indeterminate = false,
}: CompactNumberInputProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [scrubbing, setScrubbing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const clamp = useCallback((v: number) => Math.max(min, Math.min(max, v)), [min, max]);

  const formatValue = useCallback((v: number) => {
    const rounded = Math.round(v * 100) / 100;
    return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toString();
  }, []);

  /** Round to 2dp to keep accumulated scrub/nudge deltas free of float noise. */
  const tidy = useCallback((v: number) => Math.round(v * 100) / 100, []);

  const startEditing = useCallback(() => {
    if (disabled) return;
    // Mixed selection: start from an empty field so a typed value unifies all.
    setEditValue(indeterminate ? '' : formatValue(value));
    setEditing(true);
  }, [disabled, indeterminate, value, formatValue]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = useCallback(
    (raw: string) => {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) onChange(clamp(parsed));
      setEditing(false);
    },
    [onChange, clamp]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commit(editValue);
      } else if (e.key === 'Escape') {
        setEditing(false);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const delta = effectiveStep(step, e) * (e.key === 'ArrowUp' ? 1 : -1);
        const next = clamp(tidy(value + delta));
        onChange(next);
        setEditValue(formatValue(next));
      }
    },
    [editValue, commit, value, clamp, onChange, formatValue, tidy, step]
  );

  const handleScrubStart = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || editing) return;
      e.preventDefault();
      const startX = e.clientX;
      const startValue = value;
      let moved = false;

      const handleMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        if (!moved && Math.abs(dx) > SCRUB_THRESHOLD) {
          moved = true;
          setScrubbing(true);
        }
        if (!moved) return;
        const steps = Math.round(dx / PIXELS_PER_STEP);
        const next = clamp(tidy(startValue + steps * effectiveStep(step, moveEvent)));
        onChange(next);
      };

      const handleUp = () => {
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
        setScrubbing(false);
        if (!moved) startEditing();
      };

      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
    },
    [disabled, editing, value, clamp, onChange, tidy, startEditing, step]
  );

  return (
    <div
      className={cn(
        'flex h-7 items-center rounded border border-stroke-subtle bg-surface-elevated text-left transition-[box-shadow] duration-500',
        disabled && 'cursor-not-allowed opacity-50',
        highlight && 'ring-2 ring-accent/70'
      )}
      title={info}
    >
      <span
        className={cn(
          'min-w-[1.5rem] select-none px-1.5 text-[10px] leading-none transition-colors',
          // Persistent drag-handle affordance (After Effects "scrubby slider"): the
          // label always carries a dotted underline + ew-resize cursor so it reads as
          // draggable at rest, then brightens on hover and goes accent while scrubbing.
          disabled && 'text-content-tertiary',
          !disabled &&
            'cursor-ew-resize text-content-secondary underline decoration-dotted underline-offset-2 hover:text-content',
          scrubbing && 'text-accent'
        )}
        onPointerDown={handleScrubStart}
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max === Infinity ? undefined : max}
      >
        {label}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => commit(editValue)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent pr-1 text-right text-xs text-content outline-none"
          disabled={disabled}
          aria-label={label}
        />
      ) : (
        <button
          type="button"
          onClick={startEditing}
          disabled={disabled}
          className={cn(
            'min-w-0 flex-1 select-none pr-1 text-right text-xs tabular-nums outline-none',
            indeterminate ? 'text-content-tertiary' : 'text-content',
            !disabled && 'cursor-text',
            scrubbing && 'text-accent'
          )}
          aria-label={
            indeterminate
              ? `${label}: mixed`
              : `${label}: ${formatValue(value)}${unit ? ` ${unit}` : ''}`
          }
        >
          {indeterminate ? MIXED_GLYPH : formatValue(value)}
        </button>
      )}
      {unit && <span className="select-none pr-1.5 text-[10px] text-content-disabled">{unit}</span>}
    </div>
  );
}
