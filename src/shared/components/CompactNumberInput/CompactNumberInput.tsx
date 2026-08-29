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
   * real-world measurement can't silently truncate it. The caller owns
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
   * Committed value at the moment this edit began. The typed-entry ceiling reads
   * it instead of live `value`, so a store write that lands mid-edit can't move
   * the ceiling and make a clamp chase its own value into a render loop.
   */
  const editStartValue = useRef(value);

  /**
   * Ceiling applied to a typed entry. `softMax` lifts it entirely; otherwise it
   * is `max`, but never below the value held when editing began — a field must
   * not destroy its own contents just by being focused and blurred, which is
   * what a `max` that has dropped below the value would otherwise do (an oversize
   * cutout pins X's max to 0 while X still reads its stored offset).
   */
  const clampTyped = useCallback(
    (v: number) => clampRange(v, min, softMax ? Infinity : Math.max(max, editStartValue.current)),
    [softMax, min, max]
  );

  /**
   * Ceiling for a nudge or drag, given the highest content the field has held.
   *
   * Two different things can sit above `max`, and only one of them may raise
   * this. A committed `value` can, because `max` itself may have fallen beneath
   * it (an oversize cutout pins X's ceiling to 0 while X keeps its offset), and
   * such a value still has to be nudgeable. Text the user has *typed* may only
   * raise it under `softMax` — otherwise a hard-max field could be walked past
   * its own limit one arrow key at a time.
   */
  const stepCeiling = useCallback(
    (peak: number) => (softMax ? Math.max(max, peak) : Math.max(max, value)),
    [softMax, max, value]
  );

  /**
   * Highest content the field has held this visit. Held so a nudge can't ratchet
   * its own ceiling down — ArrowDown from 156 to 155 must leave ArrowUp able to
   * return — and reset on typing so a smaller entry lowers it again. The ceiling
   * is derived from it against live props, so a `max` that drops mid-edit binds
   * immediately rather than leaving a stale ceiling behind.
   */
  const [editPeak, setEditPeak] = useState(0);

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
    setEditPeak(value);
    editStartValue.current = value;
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
      // Finite, not merely non-NaN: `parseFloat` maps "Infinity" and any
      // overflowing exponent to Infinity. `softMax` has no ceiling to absorb
      // that, and downstream geometry must never see a non-finite dimension.
      //
      // Deliberately app-wide rather than gated on `softMax`. A hard `max` did
      // absorb it, but by silently committing the ceiling — so "Infinity" set a
      // rotation field to 359 while "abc" left it alone. Non-finite input is
      // unparseable garbage, not a big number, and now reverts like any other.
      // Only write a real change. A blur or Enter that lands on the committed
      // value must not call `onChange` — each store write churns references,
      // spends an undo slot, and re-renders, which lets the focus/select effect
      // steal focus, blur a neighbour, and commit again, driving a render loop.
      if (Number.isFinite(parsed)) {
        const next = clampTyped(parsed);
        if (next !== value) onChange(next);
      }
      setEditing(false);
    },
    [onChange, clampTyped, value]
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
        const peak = Math.max(editPeak, base);
        if (peak !== editPeak) setEditPeak(peak);
        const next = clampRange(tidy(base + delta), min, stepCeiling(peak));
        onChange(next);
        setEditValue(formatValue(next));
      }
    },
    [editValue, commit, value, min, editPeak, stepCeiling, onChange, formatValue, tidy, step]
  );

  const handleScrubStart = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || editing) return;
      e.preventDefault();
      const startX = e.clientX;
      const startValue = value;
      // Fixed for the drag, so the ceiling can't drift as the value moves.
      const ceiling = stepCeiling(startValue);
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
    [disabled, editing, value, min, stepCeiling, onChange, tidy, startEditing, step]
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
            // Reset rather than raise, so typing 100 over a committed 156 lowers
            // the ceiling instead of leaving arrows free to climb back to 156.
            const typed = parseFloat(e.target.value);
            setEditPeak(Number.isFinite(typed) ? typed : value);
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
      {unit && <span className="select-none pr-1.5 text-micro text-content-disabled">{unit}</span>}
    </div>
  );
}
