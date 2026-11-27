import type { CSSProperties } from 'react';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeOut(value: number): number {
  return 1 - (1 - clamp01(value)) ** 3;
}

/** 0 to 1 over `span` seconds from `start`; always 1 under reduced motion. */
export function fraction(elapsed: number, start: number, span: number, reduced: boolean): number {
  return reduced ? 1 : easeOut((elapsed - start) / span);
}

/** A number counting up from zero, landing on `value` after the first beat of the card. */
export function countUp(value: number, elapsed: number, reduced: boolean): number {
  return Math.round(value * fraction(elapsed, 0.35, 1.4, reduced));
}

/** Fades and lifts an element in at `at` seconds into the card. */
export function rise(elapsed: number, at: number, reduced: boolean): CSSProperties {
  const shown = fraction(elapsed, at, 0.6, reduced);
  return { opacity: shown, transform: `translateY(${(1 - shown) * 0.8}em)` };
}
