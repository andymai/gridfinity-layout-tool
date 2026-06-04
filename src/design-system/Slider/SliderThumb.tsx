import type { CSSProperties } from 'react';
import { cn } from '../cn';

interface SliderThumbProps {
  /** Hover or drag — brightens the knob and adds a soft accent glow. */
  active?: boolean;
  /** Pointer is held down — widens the glow ring. */
  dragging?: boolean;
  disabled?: boolean;
  /** Positioning classes (e.g. `top-1/2 -translate-x-1/2 -translate-y-1/2`). */
  className?: string;
  /** Positioning style (e.g. `{ left: '40%' }`). */
  style?: CSSProperties;
}

// Surface halo keeps the filled knob crisp even where it overlaps the
// same-colored accent fill; layered shadow + accent-muted glow mirror the
// app's button/focus polish (top-light gradient, brightness-on-hover).
const SHADOW_IDLE = '[box-shadow:0_0_0_2px_var(--color-surface),var(--shadow-sm)]';
const SHADOW_HOVER =
  '[box-shadow:0_0_0_2px_var(--color-surface),0_0_0_5px_var(--color-accent-muted),var(--shadow-md)]';
const SHADOW_DRAG =
  '[box-shadow:0_0_0_2px_var(--color-surface),0_0_0_7px_var(--color-accent-muted),var(--shadow-md)]';

/**
 * Filled, grip-textured slider knob shared by every slider surface.
 *
 * The accent body uses a top-light gradient to read as a raised physical
 * control; three short grip lines (in the on-accent tint) signal "grab me".
 * Hover/drag brighten it, scale it up slightly, and bloom an accent glow.
 */
export function SliderThumb({ active, dragging, disabled, className, style }: SliderThumbProps) {
  const lifted = (active || dragging) && !disabled;
  const shadow = disabled
    ? SHADOW_IDLE
    : dragging
      ? SHADOW_DRAG
      : active
        ? SHADOW_HOVER
        : SHADOW_IDLE;

  return (
    <div
      data-testid="slider-thumb"
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute flex h-5 w-5 items-center justify-center gap-[3px] rounded-full',
        'bg-gradient-to-b from-accent-hover to-accent',
        // Transition only the visual state — NOT position. The thumb is placed
        // via an inline `left`/`bottom`; animating it would make the knob lag
        // behind the pointer during a drag.
        'transition-[box-shadow,transform,filter] duration-100 ease-out',
        shadow,
        lifted && 'scale-105 brightness-110',
        className
      )}
      style={style}
    >
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-px rounded-full bg-on-accent/45" />
      ))}
    </div>
  );
}
