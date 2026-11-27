import { hexContrast } from '@/shared/utils/color';

/** The darkest part of the card, behind its small text. */
export const CARD_BACKGROUND = '#0d0d14';
/** WCAG AA for normal-size text. */
const MIN_CONTRAST = 4.5;

function mixWithWhite(hex: string, amount: number): string {
  const channel = (offset: number): string => {
    const value = parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(value + (255 - value) * amount)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/**
 * The accent, lightened just enough for small text on the card. Some accents
 * (violet) are too dark to read at a label's size; decoration keeps the
 * accent as chosen.
 */
export function readableAccent(accent: string, background: string = CARD_BACKGROUND): string {
  for (let step = 0; step <= 10; step++) {
    const candidate = mixWithWhite(accent, step / 10);
    if (hexContrast(candidate, background) >= MIN_CONTRAST) return candidate;
  }
  return '#ffffff';
}
