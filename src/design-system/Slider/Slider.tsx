import { forwardRef, useCallback, useId, useRef, useState } from 'react';
import { cn } from '../cn';
import { interactiveTransition } from '../variants';
import { SliderThumb } from './SliderThumb';

export interface SliderProps {
  /** Current value */
  value: number;
  /** Called on every value change (continuously during a drag). */
  onChange: (value: number) => void;
  /**
   * Called once when the user finishes a change — pointer release or a keyboard
   * step. Use this to commit a single undo entry while `onChange` drives a
   * transient live preview during the drag.
   */
  onCommit?: (value: number) => void;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Step increment (default: 1) */
  step?: number;
  /** Whether the slider is disabled */
  disabled?: boolean;
  /** Accessible label */
  'aria-label': string;
  /** ID of element describing this slider */
  'aria-describedby'?: string;
  /** Text description of current value for screen readers */
  'aria-valuetext'?: string;
  /** Additional class names for the root element */
  className?: string;
}

/**
 * Slider primitive with custom track, thumb, and pointer-event-based dragging.
 *
 * Uses a hidden <input type="range"> for keyboard navigation and ARIA semantics.
 * Visual rendering is fully custom via divs + pointer events.
 *
 * @example
 * <Slider value={50} onChange={setValue} min={0} max={100} aria-label="Volume" />
 */
export const Slider = forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      value,
      onChange,
      onCommit,
      min,
      max,
      step = 1,
      disabled = false,
      'aria-label': ariaLabel,
      'aria-describedby': ariaDescribedBy,
      'aria-valuetext': ariaValueText,
      className,
    },
    ref
  ) => {
    const id = useId();
    const trackRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isHovering, setIsHovering] = useState(false);

    const range = max - min;
    const percent = range === 0 ? 0 : ((value - min) / range) * 100;

    const pointerToValue = useCallback(
      (clientX: number): number => {
        if (!trackRef.current) return value;
        const rect = trackRef.current.getBoundingClientRect();
        const rawPercent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const rawValue = min + rawPercent * range;
        // Snap relative to min so values align to the step grid
        const snapped = min + Math.round((rawValue - min) / step) * step;
        return Math.max(min, Math.min(max, Number(snapped.toFixed(10))));
      },
      [min, max, range, step, value]
    );

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled) return;
        e.preventDefault();
        // Restore focus lost from preventDefault
        inputRef.current?.focus({ preventScroll: true });
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        const newValue = pointerToValue(e.clientX);
        if (newValue !== value) {
          onChange(newValue);
        }
      },
      [disabled, pointerToValue, value, onChange]
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        const newValue = pointerToValue(e.clientX);
        if (newValue !== value) {
          onChange(newValue);
        }
      },
      [isDragging, pointerToValue, value, onChange]
    );

    const handlePointerUp = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        setIsDragging(false);
        onCommit?.(pointerToValue(e.clientX));
      },
      [isDragging, onCommit, pointerToValue]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;
        let newValue: number | undefined;

        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          const raw = value + step;
          newValue = Math.min(max, min + Math.round((raw - min) / step) * step);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          const raw = value - step;
          newValue = Math.max(min, min + Math.round((raw - min) / step) * step);
        } else if (e.key === 'Home') {
          e.preventDefault();
          newValue = min;
        } else if (e.key === 'End') {
          e.preventDefault();
          newValue = max;
        }

        if (newValue !== undefined && newValue !== value) {
          const committed = Number(newValue.toFixed(10));
          onChange(committed);
          // Each keyboard step is a discrete change — commit it immediately so
          // arrow-key edits land in undo history individually.
          onCommit?.(committed);
        }
      },
      [disabled, value, min, max, step, onChange, onCommit]
    );

    const thumbActive = isDragging || isHovering;

    return (
      <div
        ref={ref}
        className={cn(
          // Inset by the thumb radius (w-5 ⇒ 10px) so the round handle at 0%/100%
          // stays inside the component box — otherwise it overhangs the track and
          // gets sheared by scroll/overflow ancestors (e.g. the inspector dock).
          'relative px-2.5',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          className
        )}
        onPointerEnter={() => !disabled && setIsHovering(true)}
        onPointerLeave={() => setIsHovering(false)}
      >
        {/* Interactive track area — tall for easy clicking, visual track is thinner inside */}
        <div
          ref={trackRef}
          className="relative h-8 touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Track background */}
          <div
            className={cn(
              'absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2 rounded-full bg-stroke-subtle',
              interactiveTransition,
              !disabled && isHovering && 'bg-stroke'
            )}
          />

          {/* Filled track */}
          <div
            data-testid="slider-fill"
            className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-accent"
            style={{ width: `${percent}%` }}
          />

          {/* Value bubble — shown above the thumb while dragging */}
          {isDragging && !disabled && (
            <div
              className="animate-scale-in pointer-events-none absolute -top-1.5 z-10 -translate-x-1/2 -translate-y-full rounded-md border border-stroke-subtle bg-surface-elevated px-2 py-0.5 text-xs font-semibold tabular-nums text-content shadow-md"
              style={{ left: `${percent}%` }}
            >
              {value}
            </div>
          )}

          {/* Thumb */}
          <SliderThumb
            active={thumbActive}
            dragging={isDragging}
            disabled={disabled}
            className="top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${percent}%` }}
          />

          {/* Hidden native input for keyboard navigation + ARIA */}
          <input
            ref={inputRef}
            id={id}
            type="range"
            value={value}
            onChange={(e) => {
              const newValue = Number(e.target.value);
              if (newValue !== value) {
                onChange(newValue);
              }
            }}
            onKeyDown={handleKeyDown}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={ariaLabel}
            aria-valuenow={value}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuetext={ariaValueText}
            aria-describedby={ariaDescribedBy}
            tabIndex={disabled ? -1 : 0}
          />
        </div>
      </div>
    );
  }
);

Slider.displayName = 'Slider';
