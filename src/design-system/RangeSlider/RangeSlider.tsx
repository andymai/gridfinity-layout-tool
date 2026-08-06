import { forwardRef, useCallback, useRef, useState } from 'react';
import { cn } from '../cn';
import { SliderThumb } from '../Slider/SliderThumb';
import { interactiveTransition } from '../variants';

export type RangeValue = readonly [number, number];

export interface RangeSliderProps {
  /**
   * Ascending, de-duplicated selectable values. The track is laid out in stop
   * index space, not value space, so irregular gaps (1, 1.5, 2, 4) render as
   * even steps.
   */
  stops: readonly number[];
  /** Current [lower, upper] selection. Values off the stop list snap to the nearest one. */
  value: RangeValue;
  onChange: (value: RangeValue) => void;
  /**
   * Called once when the user finishes a change — pointer release or a keyboard
   * step — while `onChange` fires continuously during a drag.
   */
  onCommit?: (value: RangeValue) => void;
  /**
   * Inclusive window of stops the user may select. Stops outside it render
   * dimmed and neither pointer nor keyboard can reach them. Defaults to the
   * full stop list.
   */
  selectable?: RangeValue;
  disabled?: boolean;
  /**
   * Renders the filled span in a neutral tone. Use when the current selection
   * places no constraint, so a full-width track does not read as an active
   * one purely because it is full.
   */
  muted?: boolean;
  /** Formats the drag bubble and the screen-reader value text. */
  formatValue?: (value: number) => string;
  /** Accessible name for the lower thumb. */
  lowerLabel: string;
  /** Accessible name for the upper thumb. */
  upperLabel: string;
  className?: string;
}

type Thumb = 'lower' | 'upper';

function nearestIndex(stops: readonly number[], value: number): number {
  let best = 0;
  let bestDistance = Infinity;
  stops.forEach((stop, index) => {
    const distance = Math.abs(stop - value);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Two-thumb range slider over a discrete list of stops.
 *
 * Each thumb is a hidden `<input type="range">` for keyboard and ARIA (per the
 * APG multi-thumb pattern, each thumb's own min/max is bounded by the other
 * thumb, so the two can meet but never cross). Visual rendering and pointer
 * dragging are custom, matching `Slider`.
 *
 * @example
 * <RangeSlider
 *   stops={[1, 2, 3, 4, 5]}
 *   value={[2, 4]}
 *   onChange={setRange}
 *   lowerLabel="Minimum width"
 *   upperLabel="Maximum width"
 * />
 */
export const RangeSlider = forwardRef<HTMLDivElement, RangeSliderProps>(
  (
    {
      stops,
      value,
      onChange,
      onCommit,
      selectable,
      disabled = false,
      muted = false,
      formatValue,
      lowerLabel,
      upperLabel,
      className,
    },
    ref
  ) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const lowerInputRef = useRef<HTMLInputElement>(null);
    const upperInputRef = useRef<HTMLInputElement>(null);
    const [draggingThumb, setDraggingThumb] = useState<Thumb | null>(null);
    const [isHovering, setIsHovering] = useState(false);

    const lastIndex = stops.length - 1;
    const inert = disabled || lastIndex < 1;

    const selectableMin = selectable === undefined ? 0 : nearestIndex(stops, selectable[0]);
    const selectableMax =
      selectable === undefined ? Math.max(lastIndex, 0) : nearestIndex(stops, selectable[1]);
    const windowMin = Math.min(selectableMin, selectableMax);
    const windowMax = Math.max(selectableMin, selectableMax);

    const rawLower = clamp(nearestIndex(stops, value[0]), windowMin, windowMax);
    const rawUpper = clamp(nearestIndex(stops, value[1]), windowMin, windowMax);
    const lowerIndex = Math.min(rawLower, rawUpper);
    const upperIndex = Math.max(rawLower, rawUpper);

    const percent = (index: number): number => (lastIndex < 1 ? 0 : (index / lastIndex) * 100);
    const format = (index: number): string => {
      const stop = stops.at(index);
      if (stop === undefined) return '';
      return formatValue?.(stop) ?? String(stop);
    };

    const emit = useCallback(
      (lower: number, upper: number, commit: boolean) => {
        const nextLower = stops.at(lower);
        const nextUpper = stops.at(upper);
        if (nextLower === undefined || nextUpper === undefined) return;
        if (nextLower !== value[0] || nextUpper !== value[1]) onChange([nextLower, nextUpper]);
        if (commit) onCommit?.([nextLower, nextUpper]);
      },
      [stops, value, onChange, onCommit]
    );

    const pointerToIndex = useCallback(
      (clientX: number): number => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (rect === undefined || rect.width === 0) return lowerIndex;
        const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
        return clamp(Math.round(ratio * lastIndex), windowMin, windowMax);
      },
      [lastIndex, lowerIndex, windowMin, windowMax]
    );

    // Ties go to whichever thumb the pointer is outside of, so grabbing the
    // track beyond the current range always widens it rather than dragging the
    // far thumb across the near one.
    const thumbFor = useCallback(
      (index: number): Thumb => {
        if (index <= lowerIndex) return 'lower';
        if (index >= upperIndex) return 'upper';
        return index - lowerIndex <= upperIndex - index ? 'lower' : 'upper';
      },
      [lowerIndex, upperIndex]
    );

    const applyDrag = useCallback(
      (thumb: Thumb, index: number, commit: boolean) => {
        if (thumb === 'lower') emit(Math.min(index, upperIndex), upperIndex, commit);
        else emit(lowerIndex, Math.max(index, lowerIndex), commit);
      },
      [emit, lowerIndex, upperIndex]
    );

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (inert) return;
        e.preventDefault();
        const index = pointerToIndex(e.clientX);
        const thumb = thumbFor(index);
        // preventDefault swallows the focus the click would have given the
        // input, so hand it to the thumb the drag is about to move.
        (thumb === 'lower' ? lowerInputRef : upperInputRef).current?.focus({ preventScroll: true });
        e.currentTarget.setPointerCapture(e.pointerId);
        setDraggingThumb(thumb);
        applyDrag(thumb, index, false);
      },
      [inert, pointerToIndex, thumbFor, applyDrag]
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (draggingThumb === null) return;
        applyDrag(draggingThumb, pointerToIndex(e.clientX), false);
      },
      [draggingThumb, pointerToIndex, applyDrag]
    );

    const handlePointerUp = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (draggingThumb === null) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        applyDrag(draggingThumb, pointerToIndex(e.clientX), true);
        setDraggingThumb(null);
      },
      [draggingThumb, pointerToIndex, applyDrag]
    );

    const handleKeyDown = useCallback(
      (thumb: Thumb) => (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (inert) return;
        const current = thumb === 'lower' ? lowerIndex : upperIndex;
        const min = thumb === 'lower' ? windowMin : lowerIndex;
        const max = thumb === 'lower' ? upperIndex : windowMax;
        let next: number | undefined;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = current + 1;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = current - 1;
        else if (e.key === 'Home') next = min;
        else if (e.key === 'End') next = max;
        if (next === undefined) return;
        e.preventDefault();
        const clamped = clamp(next, min, max);
        if (clamped === current) return;
        if (thumb === 'lower') emit(clamped, upperIndex, true);
        else emit(lowerIndex, clamped, true);
      },
      [inert, lowerIndex, upperIndex, windowMin, windowMax, emit]
    );

    // An empty stop list still renders (disabled) while an index loads, and a
    // slider whose ARIA value state is `undefined` is worse than one parked
    // at a placeholder.
    const valueAt = (index: number): number => stops.at(index) ?? 0;

    const thumbInput = (thumb: Thumb) => {
      const isLower = thumb === 'lower';
      const index = isLower ? lowerIndex : upperIndex;
      return (
        <input
          ref={isLower ? lowerInputRef : upperInputRef}
          type="range"
          value={index}
          min={isLower ? windowMin : lowerIndex}
          max={isLower ? upperIndex : windowMax}
          step={1}
          disabled={inert}
          onChange={() => {
            // Keyboard and pointer are handled explicitly above; this exists
            // only to keep the input controlled.
          }}
          onKeyDown={handleKeyDown(thumb)}
          // Pointer belongs to the track: a full-size input on top would
          // otherwise run its own native drag against ours.
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          aria-label={isLower ? lowerLabel : upperLabel}
          aria-valuenow={valueAt(index)}
          aria-valuemin={valueAt(isLower ? windowMin : lowerIndex)}
          aria-valuemax={valueAt(isLower ? upperIndex : windowMax)}
          aria-valuetext={format(index)}
          tabIndex={inert ? -1 : 0}
        />
      );
    };

    const activeIndex = draggingThumb === 'upper' ? upperIndex : lowerIndex;

    return (
      <div
        ref={ref}
        data-testid="range-slider"
        className={cn(
          // Inset by the thumb radius (w-5 ⇒ 10px) so a knob parked at 0%/100%
          // stays inside the component box instead of being sheared by an
          // overflow ancestor.
          'relative px-2.5',
          inert ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          className
        )}
        onPointerEnter={() => !inert && setIsHovering(true)}
        onPointerLeave={() => setIsHovering(false)}
      >
        <div
          ref={trackRef}
          className="relative h-8 touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className={cn(
              'absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-stroke-subtle',
              interactiveTransition,
              !inert && isHovering && 'bg-stroke'
            )}
          />

          {/* Out-of-reach stops. Hatching rather than a plain gap so a track
              that ends early reads as "nothing here matches", not as a
              shorter axis. */}
          {windowMin > 0 && (
            <div
              data-testid="range-slider-blocked-start"
              aria-hidden="true"
              className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-l-full bg-stroke-subtle opacity-40 [background-image:repeating-linear-gradient(45deg,transparent,transparent_2px,var(--color-stroke)_2px,var(--color-stroke)_4px)]"
              style={{ width: `${percent(windowMin)}%` }}
            />
          )}
          {windowMax < lastIndex && (
            <div
              data-testid="range-slider-blocked-end"
              aria-hidden="true"
              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-r-full bg-stroke-subtle opacity-40 [background-image:repeating-linear-gradient(45deg,transparent,transparent_2px,var(--color-stroke)_2px,var(--color-stroke)_4px)]"
              style={{ left: `${percent(windowMax)}%`, right: 0 }}
            />
          )}

          <div
            data-testid="range-slider-fill"
            className={cn(
              'absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full',
              muted ? 'bg-stroke' : 'bg-accent'
            )}
            style={{
              left: `${percent(lowerIndex)}%`,
              width: `${percent(upperIndex) - percent(lowerIndex)}%`,
            }}
          />

          {draggingThumb !== null && !inert && (
            <div
              className="animate-scale-in pointer-events-none absolute -top-1.5 z-10 -translate-x-1/2 -translate-y-full rounded-md border border-stroke-subtle bg-surface-elevated px-2 py-0.5 text-xs font-semibold tabular-nums text-content shadow-md"
              style={{ left: `${percent(activeIndex)}%` }}
            >
              {format(activeIndex)}
            </div>
          )}

          <SliderThumb
            active={isHovering || draggingThumb === 'lower'}
            dragging={draggingThumb === 'lower'}
            disabled={inert}
            className="top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${percent(lowerIndex)}%` }}
          />
          <SliderThumb
            active={isHovering || draggingThumb === 'upper'}
            dragging={draggingThumb === 'upper'}
            disabled={inert}
            className="top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${percent(upperIndex)}%` }}
          />

          {thumbInput('lower')}
          {thumbInput('upper')}
        </div>
      </div>
    );
  }
);

RangeSlider.displayName = 'RangeSlider';
