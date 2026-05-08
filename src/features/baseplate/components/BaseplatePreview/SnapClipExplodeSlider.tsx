import { useCallback, useId, useRef, useState } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/design-system/cn';
import { interactiveTransition } from '@/design-system/variants';

export const SNAP_CLIP_OFFSET_MIN = 0;
export const SNAP_CLIP_OFFSET_MAX = 50;
export const SNAP_CLIP_OFFSET_DEFAULT = 0;

interface SnapClipExplodeSliderProps {
  value: number;
  onChange: (mm: number) => void;
}

export function SnapClipExplodeSlider({ value, onChange }: SnapClipExplodeSliderProps) {
  const t = useTranslation();
  const id = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const range = SNAP_CLIP_OFFSET_MAX - SNAP_CLIP_OFFSET_MIN;
  const percent = range === 0 ? 0 : ((value - SNAP_CLIP_OFFSET_MIN) / range) * 100;

  const pointerToValue = useCallback(
    (clientY: number): number => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const rawPercent = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
      const raw = SNAP_CLIP_OFFSET_MIN + rawPercent * range;
      return Math.max(SNAP_CLIP_OFFSET_MIN, Math.min(SNAP_CLIP_OFFSET_MAX, Math.round(raw)));
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
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      let next: number | undefined;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        next = Math.min(SNAP_CLIP_OFFSET_MAX, value + 1);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        next = Math.max(SNAP_CLIP_OFFSET_MIN, value - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        next = SNAP_CLIP_OFFSET_MIN;
      } else if (e.key === 'End') {
        e.preventDefault();
        next = SNAP_CLIP_OFFSET_MAX;
      }
      if (next !== undefined && next !== value) onChange(next);
    },
    [value, onChange]
  );

  const thumbActive = isDragging || isHovering;

  return (
    <div
      // top-1/3 (not top-1/2) so this doesn't collide with the lid slider in
      // shared layouts; lid slider lives at top-1/2.
      className="absolute right-2 top-1/3 z-10 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-lg bg-surface-elevated/80 px-2 py-2.5 shadow-sm backdrop-blur"
      onPointerEnter={() => setIsHovering(true)}
      onPointerLeave={() => setIsHovering(false)}
    >
      <span className="text-[11px] font-medium text-content-secondary">
        {t('baseplate.snapClipLifted')}
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
          data-testid="snap-slider-fill"
          className="absolute bottom-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-accent"
          style={{ height: `${percent}%` }}
        />

        <div
          data-testid="snap-slider-thumb"
          className={cn(
            'pointer-events-none absolute left-1/2 h-5 w-5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-accent bg-surface shadow-sm',
            interactiveTransition,
            thumbActive && 'scale-110 shadow-md',
            isDragging && 'ring-2 ring-accent/30'
          )}
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
          min={SNAP_CLIP_OFFSET_MIN}
          max={SNAP_CLIP_OFFSET_MAX}
          step={1}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={t('baseplate.snapClipExplodeSlider')}
          aria-orientation="vertical"
          aria-valuenow={value}
          aria-valuemin={SNAP_CLIP_OFFSET_MIN}
          aria-valuemax={SNAP_CLIP_OFFSET_MAX}
          aria-valuetext={`${value}mm`}
        />
      </div>

      <span className="text-[11px] font-medium text-content-secondary">
        {t('baseplate.snapClipSeated')}
      </span>
    </div>
  );
}
