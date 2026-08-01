/**
 * Figma-style compact, number-first input.
 *
 * Number is primary: click the value to type an exact number, drag the label
 * to scrub coarsely, or use arrow keys to nudge. Modifiers apply to both scrub
 * and arrows — Shift = ×10 step, Alt = fine (÷10) step. Enter commits, Escape
 * reverts.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/design-system';
import { cn } from '@/design-system/cn';
import { clamp as clampRange } from '@/shared/utils/math';

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
  /**
   * Treat `max` as a soft ceiling for typed entries only, so a field holding a
   * real-world measurement can't silently truncate it (#3061). The caller owns
   * what happens next.
   *
   * Overflow stays typed-only: scrubbing and arrow keys still stop at `max`,
   * and past it they stop at whatever is currently in the field, so no gesture
   * can raise a value beyond what the user entered.
   */
  readonly softMax?: boolean;
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
  softMax = false,
}: CompactNumberInputProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [scrubbing, setScrubbing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Ceiling applied to a typed entry. `softMax` lifts it entirely; otherwise it
   * is `max`, but never below the value already held — a field must not destroy
   * its own contents just by being focused and blurred, which is what a `max`
   * that has dropped below `value` would otherwise do (an oversize cutout pins
   * X's max to 0 while X still reads its stored offset).
   */
  const clampTyped = useCallback(
    (v: number) => clampRange(v, min, softMax ? Infinity : Math.max(max, value)),
    [softMax, min, max, value]
  );

  /**
   * Step ceiling for a gesture — a drag, or the current contents of the text
   * field. `max`, or the starting value when that already sits above it.
   *
   * Independent of `softMax`, which governs typed commits only: a hard `max`
   * can also fall below the value, and a nudge must be able to move such a
   * value without being yanked to the ceiling first.
   *
   * Held for the gesture rather than recomputed per keystroke, because a
   * per-keystroke ceiling follows the value down — ArrowDown from 156 to 155
   * would drop the ceiling to 155 and ArrowUp could never get back.
   */
  const ceilingFrom = useCallback((start: number) => Math.max(max, start), [max]);
  const [editCeiling, setEditCeiling] = useState(max);

  /**
   * Round to 2dp, keeping accumulated scrub/nudge deltas free of float noise.
   * Guarded: `v * 100` overflows to Infinity past ~9e306, which would render a
   * committed finite entry as "Infinity" and wedge the field, since that string
   * no longer parses back to anything committable.
   */
  const round2 = useCallback((v: number) => {
    const scaled = v * 100;
    return Number.isFinite(scaled) ? Math.round(scaled) / 100 : v;
  }, []);

  const formatValue = useCallback(
    (v: number) => {
      const rounded = round2(v);
      return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toString();
    },
    [round2]
  );

  const tidy = round2;

  const startEditing = useCallback(() => {
    if (disabled) return;
    // Mixed selection: start from an empty field so a typed value unifies all.
    setEditValue(indeterminate ? '' : formatValue(value));
    setEditCeiling(ceilingFrom(value));
    setEditing(true);
  }, [disabled, indeterminate, value, formatValue, ceilingFrom]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = useCallback(
    (raw: string) => {
      const parsed = parseFloat(raw);
      // Finite, not merely non-NaN: `parseFloat` maps "Infinity" and any
      // overflowing exponent to Infinity. `softMax` has no ceiling to absorb
      // that, and downstream geometry must never see a non-finite dimension.
      //
      // Deliberately app-wide rather than gated on `softMax`. A hard `max` did
      // absorb it, but by silently committing the ceiling — so "Infinity" set a
      // rotation field to 359 while "abc" left it alone. Non-finite input is
      // unparseable garbage, not a big number, and now reverts like any other.
      if (Number.isFinite(parsed)) onChange(clampTyped(parsed));
      setEditing(false);
    },
    [onChange, clampTyped]
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
        // Nudge from what the field shows, not the last committed value: typing
        // 156 over a committed 10 and pressing ArrowDown must reach 155, not 9.5.
        // (`editValue` is empty for an untouched mixed selection, hence the
        // fallback.)
        const typed = parseFloat(editValue);
        const base = Number.isFinite(typed) ? typed : value;
        // A typed value can sit above the ceiling captured on entry, so raise it
        // — upward only, which is what keeps a nudge from ratcheting back down.
        const ceiling = Math.max(editCeiling, ceilingFrom(base));
        if (ceiling !== editCeiling) setEditCeiling(ceiling);
        const next = clampRange(tidy(base + delta), min, ceiling);
        onChange(next);
        setEditValue(formatValue(next));
      }
    },
    [editValue, commit, value, min, editCeiling, ceilingFrom, onChange, formatValue, tidy, step]
  );

  const handleScrubStart = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || editing) return;
      e.preventDefault();
      const startX = e.clientX;
      const startValue = value;
      // Fixed for the drag, so the ceiling can't drift as the value moves.
      const ceiling = ceilingFrom(startValue);
      let moved = false;

      const handleMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        if (!moved && Math.abs(dx) > SCRUB_THRESHOLD) {
          moved = true;
          setScrubbing(true);
        }
        if (!moved) return;
        const steps = Math.round(dx / PIXELS_PER_STEP);
        const next = clampRange(
          tidy(startValue + steps * effectiveStep(step, moveEvent)),
          min,
          ceiling
        );
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
    [disabled, editing, value, min, ceilingFrom, onChange, tidy, startEditing, step]
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
          'min-w-[1.5rem] select-none px-1.5 text-xs leading-none transition-colors',
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
        // The announced range always contains the value: publishing valuenow >
        // valuemax is an invalid slider state. Independent of `softMax` — a hard
        // ceiling can also sit below the value (an oversize cutout leaves no
        // valid X offset, so X's max is 0 while it still reads its old offset).
        aria-valuemax={max === Infinity ? undefined : Math.max(max, value)}
      >
        {label}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            // Re-derive the nudge ceiling from what is now in the field. Without
            // this it only ever rises, so typing 100 over a committed 156 would
            // leave arrows free to climb back to 156, past both `max` and the
            // number actually entered.
            const typed = parseFloat(e.target.value);
            setEditCeiling(ceilingFrom(Number.isFinite(typed) ? typed : value));
          }}
          onBlur={() => commit(editValue)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent pr-1 text-right text-xs text-content outline-none"
          disabled={disabled}
          aria-label={label}
        />
      ) : (
        <Button
          variant="ghost"
          type="button"
          onClick={startEditing}
          disabled={disabled}
          className={cn(
            'h-full min-w-0 flex-1 select-none justify-end rounded-none px-0 pr-1 py-0 text-right text-xs font-normal tabular-nums hover:bg-transparent',
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
        </Button>
      )}
      {unit && <span className="select-none pr-1.5 text-[10px] text-content-disabled">{unit}</span>}
    </div>
  );
}
