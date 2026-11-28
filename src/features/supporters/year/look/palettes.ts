import type { YearCardKind } from '../utils/yearCards';
import { luminance, mix } from './color';

/**
 * One loud world per card. `bg` and `ink` meet WCAG AA for text; the rest
 * colour the card's bins and furniture.
 */
export const PALETTES = {
  intro: { bg: '#2733E0', ink: '#FFFFFF', plate: '#1C27B0', digit: '#0E1773' },
  drawers: {
    bg: '#FF6A1F',
    ink: '#2A0618',
    cab: '#3B0A2A',
    inside: '#1E0416',
    front: '#FFD0B0',
    frontHi: '#FFE6D3',
    frontLo: '#E3A27A',
    holder: '#FFF4EC',
  },
  bins: {
    bg: '#2EE6A8',
    ink: '#053B26',
    bin: '#D0105F',
    binHi: '#F2559A',
    binLo: '#7C0738',
    plate: '#1FBF8A',
  },
  area: { bg: '#007A7A', ink: '#FFFFFF', socket: '#006767' },
  biggest: {
    bg: '#D81F2B',
    ink: '#FFFFFF',
    bin: '#9ADCFF',
    tray: '#5A0A14',
    socket: '#6C1020',
    frame: '#3E050C',
    front: '#9A0F1C',
    trayShade: '#2E0308',
  },
  size: {
    bg: '#4FC3FF',
    ink: '#06204A',
    face: '#F2452B',
    hi: '#FF7E66',
    lo: '#A3200F',
    label: '#FFFFFF',
    floorShadow: '#2FA4E0',
  },
  designs: { bg: '#0B8040', ink: '#FFFFFF', shelf: '#06552A' },
  month: { bg: '#FF8AD0', ink: '#3A0630', month: '#7A1060', plate: '#E66DB5' },
  filament: { bg: '#F2452B', ink: '#14093A', bin: '#FFE135' },
  longest: { bg: '#B49CFF', ink: '#1E0A4F', tint: '#7350F0', shadow: '#9B82F4' },
  complicated: { bg: '#FFB81C', ink: '#2B1700', tint: '#D27800', shadow: '#E39700' },
  exports: {
    bg: '#D61A7F',
    ink: '#FFFFFF',
    plate: '#6A0B3F',
    plateEdge: '#4C072C',
    bin: '#FFC2E2',
    binLo: '#F28DC2',
    binShade: '#E06AA9',
    wall: '#B84A86',
  },
  type: {
    bg: '#3D14C7',
    ink: '#E4DBFF',
    vis: '#D4FF38',
    visHi: '#E4FF73',
    visLo: '#B3DE1F',
    hot: '#FFFFFF',
    bed: '#2A0B8F',
  },
  summary: { bg: '#FFE135', ink: '#121A5C', cab: '#121A5C', slot: '#0A0F3D' },
  thanks: { bg: '#2733E0', ink: '#FFFFFF', plate: '#1C27B0' },
} as const satisfies Record<
  YearCardKind,
  { readonly bg: string; readonly ink: string; readonly [part: string]: string }
>;

export interface CardColours {
  readonly bg: string;
  readonly ink: string;
}

export function cardColours(kind: YearCardKind): CardColours {
  const { bg, ink } = PALETTES[kind];
  return { bg, ink };
}

/** The dark room the first card's colour fills into. */
export const STAGE_COLOURS: CardColours = { bg: '#07070B', ink: '#FFFFFF' };

/** The toybox: the colours the year's cards are made of. */
export const TOY = [
  '#D0105F',
  '#9ADCFF',
  '#D4FF38',
  '#FFB81C',
  '#2EE6A8',
  '#B49CFF',
  '#FF6A1F',
  '#FF8AD0',
  '#F4F4F4',
  '#FFE135',
] as const;

export function toy(index: number): string {
  return TOY[((index % TOY.length) + TOY.length) % TOY.length] ?? TOY[0];
}

export interface TileColours {
  readonly rim: string;
  readonly floor: string;
  readonly shade: string;
}

/** A 1×1 bin seen from above in the card's colour, for the fill between cards. */
export function tileColours(bg: string): TileColours {
  const dark = luminance(bg) < 0.3;
  return {
    floor: bg,
    rim: dark ? mix(bg, '#FFFFFF', 0.22) : mix(bg, '#000000', 0.1),
    shade: mix(bg, '#000000', 0.14),
  };
}
