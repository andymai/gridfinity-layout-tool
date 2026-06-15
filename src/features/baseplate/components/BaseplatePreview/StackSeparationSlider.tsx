/**
 * Canvas-chrome vertical slider that explodes a print-stack apart in the 3D
 * preview so the user can inspect the copies and their separation interface.
 * Drag up = separate; drag down = collapse to the true export gap (0 extra).
 * Visual only — it does not change the exported gap.
 *
 * Mirrors the bin designer's lid open/close slider so the two read alike.
 */

import { useCallback, useId, useRef, useState } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/design-system/cn';
import { interactiveTransition } from '@/design-system/variants';
import { SliderThumb } from '@/design-system/Slider';

export const STACK_SEPARATION_MIN = 0;
export const STACK_SEPARATION_MAX = 60;

interface StackSeparationSliderProps {
  value: number;
  onChange: (mm: number) => void;
}

export function StackSeparationSlider({ value, onChange }: StackSeparationSliderProps) {
  const t = useTranslation();
  const id = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const range = STACK_SEPARATION_MAX - STACK_SEPARATION_MIN;
  const percent = range === 0 ? 0 : ((value - STACK_SEPARATION_MIN) / range) * 100;

  const pointerToValue = useCallback(
    (clientY: number): number => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const rawPercent = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
      const raw = STACK_SEPARATION_MIN + rawPercent * range;
      return Math.max(STACK_SEPARATION_MIN, Math.min(STACK_SEPARATION_MAX, Math.round(raw)));
    },
    [range, value]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      inputRef.current?.focus({ preventScroll: true });
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      const next = pointerToValue(e.clientY);
      if (next !== value) onChange(next);
    },
    [pointerToValue, value, onChange]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const next = pointerToValue(e.clientY);
      if (next !== value) onChange(next);
    },
    [isDragging, pointerToValue, value, onChange]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // releasePointerCapture throws if capture was already lost/cancelled.
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      let next: number | undefined;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        next = Math.min(STACK_SEPARATION_MAX, value + 1);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        next = Math.max(STACK_SEPARATION_MIN, value - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        next = STACK_SEPARATION_MIN;
      } else if (e.key === 'End') {
        e.preventDefault();
        next = STACK_SEPARATION_MAX;
      }
      if (next !== undefined && next !== value) onChange(next);
    },
    [value, onChange]
  );

  const thumbActive = isDragging || isHovering;

  return (
    <div
      className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-lg bg-surface-elevated/80 px-2 py-2.5 shadow-sm backdrop-blur"
      onPointerEnter={() => setIsHovering(true)}
      onPointerLeave={() => setIsHovering(false)}
    >
      <span className="text-[11px] font-medium text-content-secondary">
        {t('baseplate.stackPrint.separate')}
      </span>

      <div
        ref={trackRef}
        className="relative h-32 w-6 cursor-pointer touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className={cn(
            'absolute top-0 bottom-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-stroke-subtle',
            interactiveTransition,
            isHovering && 'bg-stroke'
          )}
        />
        <div
          data-testid="stack-separation-fill"
          className="absolute bottom-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-accent"
          style={{ height: `${percent}%` }}
        />
        {isDragging && (
          <div
            className="animate-scale-in pointer-events-none absolute right-full z-10 mr-1.5 translate-y-1/2 rounded-md border border-stroke-subtle bg-surface-elevated px-2 py-0.5 text-xs font-semibold tabular-nums text-content shadow-md"
            style={{ bottom: `${percent}%` }}
          >
            {value}
          </div>
        )}
        <SliderThumb
          active={thumbActive}
          dragging={isDragging}
          className="left-1/2 -translate-x-1/2 translate-y-1/2"
          style={{ bottom: `${percent}%` }}
        />
        <input
          ref={inputRef}
          id={id}
          type="range"
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (next !== value) onChange(next);
          }}
          onKeyDown={handleKeyDown}
          min={STACK_SEPARATION_MIN}
          max={STACK_SEPARATION_MAX}
          step={1}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={t('baseplate.stackPrint.separationSlider')}
          aria-orientation="vertical"
          aria-valuenow={value}
          aria-valuemin={STACK_SEPARATION_MIN}
          aria-valuemax={STACK_SEPARATION_MAX}
          aria-valuetext={`${value}mm`}
        />
      </div>

      <span className="text-[11px] font-medium text-content-secondary">
        {t('baseplate.stackPrint.together')}
      </span>
    </div>
  );
}
