import { hexContrast } from '@/shared/utils/color';

/** The darkest part of the card, behind its small text. */
export const CARD_BACKGROUND = '#0d0d14';
/** WCAG AA for normal-size text. */
const MIN_CONTRAST = 4.5;

function mix(from: string, to: string, amount: number): string {
  const channel = (offset: number): string => {
    const a = parseInt(from.slice(offset, offset + 2), 16);
    const b = parseInt(to.slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * amount)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/**
 * The brightest point behind the card's header: its top colour under the
 * accent glow at full strength (the `40` alpha in the stage's gradient).
 */
export function headerBackground(accent: string): string {
  return mix('#16161f', accent, 0x40 / 0xff);
}

/**
 * The accent, lightened just enough for small text on the card. Some accents
 * (violet) are too dark to read at a label's size; decoration keeps the
 * accent as chosen.
 */
export function readableAccent(accent: string, background: string = CARD_BACKGROUND): string {
  for (let step = 0; step <= 10; step++) {
    const candidate = mix(accent, '#ffffff', step / 10);
    if (hexContrast(candidate, background) >= MIN_CONTRAST) return candidate;
  }
  return '#ffffff';
}
