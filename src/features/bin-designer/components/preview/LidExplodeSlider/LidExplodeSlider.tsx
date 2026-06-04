/**
 * Canvas-chrome vertical slider for separating the lid from the bin in
 * the 3D preview. Drag up = lift the lid (max 80mm above the snapped
 * position); drag down = snap closed.
 *
 * Vertical orientation matches the spatial dimension being controlled —
 * the lid moves along Z, so the control should too. The slider lives on
 * the right edge, vertically centered, so it doesn't overlap the
 * camera/wireframe toolbar at top-right or the loading indicator at
 * bottom-center, and it adopts the toolbar's pill styling so the two
 * read as a single control surface.
 */

import { useCallback, useId, useRef, useState } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/design-system/cn';
import { interactiveTransition } from '@/design-system/variants';
import { SliderThumb } from '@/design-system/Slider';

/**
 * Slider range in mm. Closed position is exactly the lid's mated
 * position — `lidGroupZ` already aligns lid-local `z=anchorZ` with
 * the bin's lip top, so at offset=0 the lid's outer wall starts
 * tapering exactly where the bin's lip begins. That's the visually
 * "closed" position the user expects.
 *
 * Z-fighting between the lid's outer wall and the bin's lip outer
 * face is handled by `polygonOffset` on the lid's material — see
 * `LidMesh.tsx`. We DO NOT lift the lid off the mated position to
 * dodge z-fighting; doing that gives the lid a visible "lifted" gap
 * which the user reads as wrong.
 */
export const LID_OFFSET_MIN = 0;
export const LID_OFFSET_MAX = 80;
/** Initial position when the lid is first enabled. */
export const LID_OFFSET_DEFAULT = 30;

interface LidExplodeSliderProps {
  value: number;
  onChange: (mm: number) => void;
}

export function LidExplodeSlider({ value, onChange }: LidExplodeSliderProps) {
  const t = useTranslation();
  const id = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const range = LID_OFFSET_MAX - LID_OFFSET_MIN;
  const percent = range === 0 ? 0 : ((value - LID_OFFSET_MIN) / range) * 100;

  const pointerToValue = useCallback(
    (clientY: number): number => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      // Invert Y: top of track = max (lid open), bottom = min (snapped).
      const rawPercent = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
      const raw = LID_OFFSET_MIN + rawPercent * range;
      return Math.max(LID_OFFSET_MIN, Math.min(LID_OFFSET_MAX, Math.round(raw)));
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
      // ArrowUp/Right = increase (lift higher); ArrowDown/Left = decrease.
      let next: number | undefined;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        next = Math.min(LID_OFFSET_MAX, value + 1);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        next = Math.max(LID_OFFSET_MIN, value - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        next = LID_OFFSET_MIN;
      } else if (e.key === 'End') {
        e.preventDefault();
        next = LID_OFFSET_MAX;
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
        {t('binDesigner.preview.lidOpen')}
      </span>

      {/* Interactive track area — wider than the visual track for easy clicking. */}
      <div
        ref={trackRef}
        className="relative h-32 w-6 cursor-pointer touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Track background */}
        <div
          className={cn(
            'absolute top-0 bottom-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-stroke-subtle',
            interactiveTransition,
            isHovering && 'bg-stroke'
          )}
        />

        {/* Filled portion grows upward from the bottom (closed → open). */}
        <div
          data-testid="slider-fill"
          className="absolute bottom-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-accent"
          style={{ height: `${percent}%` }}
        />

        {/* Value bubble — shown beside the thumb while dragging. */}
        {isDragging && (
          <div
            className="animate-scale-in pointer-events-none absolute right-full z-10 mr-1.5 translate-y-1/2 rounded-md border border-stroke-subtle bg-surface-elevated px-2 py-0.5 text-xs font-semibold tabular-nums text-content shadow-md"
            style={{ bottom: `${percent}%` }}
          >
            {value}
          </div>
        )}

        {/* Thumb — `bottom: percent%` so 0% sits at the closed end, 100% at open. */}
        <SliderThumb
          active={thumbActive}
          dragging={isDragging}
          className="left-1/2 -translate-x-1/2 translate-y-1/2"
          style={{ bottom: `${percent}%` }}
        />

        {/* Hidden native input for keyboard navigation + ARIA. */}
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
          min={LID_OFFSET_MIN}
          max={LID_OFFSET_MAX}
          step={1}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={t('binDesigner.preview.lidExplodeSlider')}
          aria-orientation="vertical"
          aria-valuenow={value}
          aria-valuemin={LID_OFFSET_MIN}
          aria-valuemax={LID_OFFSET_MAX}
          aria-valuetext={`${value}mm`}
        />
      </div>

      <span className="text-[11px] font-medium text-content-secondary">
        {t('binDesigner.preview.lidClosed')}
      </span>
    </div>
  );
}
