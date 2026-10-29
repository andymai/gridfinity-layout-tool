import { useEffect } from 'react';
import { useLatestRef } from '@/shared/hooks';
import type { CreditsClock } from '../utils/creditsClock';
import { scrubTime, type RollTimeline } from '../utils/rollTimeline';

/** Playback rate while an arrow key or a hold button is down. */
export const HOLD_RATE = 6;
/** Movement before a press becomes a drag, so taps on a credit still click it. */
const DRAG_THRESHOLD_PX = 6;
const LINE_PX = 32;

/** Marks a region (the panel, the search form) whose input belongs to it, not the roll. */
export const NO_SCRUB_ATTR = 'data-no-scrub';

interface ScrubOptions {
  enabled: boolean;
  target: React.RefObject<HTMLElement | null>;
  clock: CreditsClock;
  timeline: RollTimeline | null;
  baseSpeed: number;
  onTogglePause: () => void;
  onSkip: () => void;
}

function ignored(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(`[${NO_SCRUB_ATTR}]`)) return true;
  return target.matches('input, textarea, select, [contenteditable="true"]');
}

/**
 * Wheel, drag and arrow keys move the playhead while the roll is up. Wheel
 * and drag scrub by distance; held arrows fast-forward or rewind like a
 * tape; Space pauses and End skips to the finale.
 */
export function useRollScrub({
  enabled,
  target,
  clock,
  timeline,
  baseSpeed,
  onTogglePause,
  onSkip,
}: ScrubOptions): void {
  const handlers = useLatestRef({ onTogglePause, onSkip });

  useEffect(() => {
    const el = target.current;
    if (!enabled || !el || !timeline) return;

    const scrubBy = (deltaPx: number) =>
      clock.seek(scrubTime(timeline, clock.time, deltaPx, baseSpeed));

    const onWheel = (e: WheelEvent) => {
      if (ignored(e.target)) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? el.clientHeight : 1;
      scrubBy(e.deltaY * unit);
    };

    let drag: { id: number; lastY: number; travelled: number; active: boolean } | null = null;
    let swallowClicksUntil = 0;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || ignored(e.target)) return;
      drag = { id: e.pointerId, lastY: e.clientY, travelled: 0, active: false };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dy = e.clientY - drag.lastY;
      drag.lastY = e.clientY;
      drag.travelled += Math.abs(dy);
      if (!drag.active && drag.travelled > DRAG_THRESHOLD_PX) {
        drag.active = true;
        clock.setHoldRate(0);
        el.setPointerCapture(e.pointerId);
      }
      if (drag.active) scrubBy(-dy);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.active) {
        clock.setHoldRate(null);
        swallowClicksUntil = performance.now() + 80;
      }
      drag = null;
    };
    // A drag that ends on a credit must not also click it.
    const onClickCapture = (e: MouseEvent) => {
      if (performance.now() < swallowClicksUntil) e.stopPropagation();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (ignored(e.target)) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (!e.repeat) clock.setHoldRate(HOLD_RATE);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!e.repeat) clock.setHoldRate(-HOLD_RATE);
      } else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        handlers.current.onTogglePause();
      } else if (e.key === 'End') {
        e.preventDefault();
        handlers.current.onSkip();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key.startsWith('Arrow')) clock.setHoldRate(null);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('click', onClickCapture, { capture: true });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('click', onClickCapture, { capture: true });
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      clock.setHoldRate(null);
    };
  }, [enabled, target, clock, timeline, baseSpeed, handlers]);
}
