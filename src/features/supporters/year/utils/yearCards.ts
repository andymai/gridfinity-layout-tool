import { BEAT } from '../look/motion';
import type { YearStats } from '../types';

export type YearCardKind =
  | 'intro'
  | 'drawers'
  | 'bins'
  | 'area'
  | 'biggest'
  | 'size'
  | 'designs'
  | 'month'
  | 'filament'
  | 'longest'
  | 'complicated'
  | 'exports'
  | 'type'
  | 'summary'
  | 'thanks';

export interface YearCard {
  readonly kind: YearCardKind;
  /** Beats the card holds the screen, before the fill into the next card. */
  readonly beats: number;
  /** Seconds from the card's start to the next card's: its beats and the fill. */
  readonly duration: number;
  /** Seconds in, when every entrance on the card has finished. */
  readonly settle: number;
}

/** The fill of bins between two cards. */
export const FILL_BEATS = 1;
/** The first card's colour fills an empty stage for this long. */
export const ENTRANCE_BEATS = 2;
/** The fill fades off the new card over this long. */
export const DISSOLVE_BEATS = 0.45;

const BEATS: Readonly<Record<YearCardKind, number>> = {
  intro: 7,
  drawers: 6,
  bins: 8,
  area: 8,
  biggest: 8,
  size: 6,
  designs: 7,
  month: 8,
  filament: 6,
  longest: 8,
  complicated: 9,
  exports: 7,
  type: 10,
  summary: 7,
  thanks: 8,
};

/** Beats until the last entrance has landed: the frame a paused step and the share image show. */
const SETTLE_BEATS: Readonly<Record<YearCardKind, number>> = {
  intro: 5.25,
  drawers: 4.75,
  bins: 6.25,
  area: 5.75,
  biggest: 6.25,
  size: 4.25,
  designs: 5.25,
  month: 6.25,
  filament: 4.25,
  longest: 6.25,
  complicated: 6.25,
  exports: 5.25,
  type: 8.25,
  summary: 4.5,
  thanks: 5.75,
};

/** A card shows only when its numbers exist; the type, summary and thanks always show. */
export function buildYearCards(stats: YearStats): YearCard[] {
  const shown: Readonly<Record<YearCardKind, boolean>> = {
    intro: true,
    drawers: stats.drawers > 0,
    bins: stats.binsPlaced > 0,
    area: stats.drawers > 0,
    biggest: stats.biggestDrawer !== null,
    size: stats.favouriteSize !== null,
    designs: stats.designs > 0,
    month: stats.busiestMonth !== null,
    filament: stats.filament !== null,
    longest: stats.longestPrint !== null,
    complicated: stats.complexityShortlist.length > 0,
    exports: stats.exports > 0,
    type: true,
    summary: true,
    thanks: true,
  };
  const kinds = (Object.keys(BEATS) as YearCardKind[]).filter((kind) => shown[kind]);
  return kinds.map((kind, index) => yearCard(kind, index === kinds.length - 1));
}

export function yearCard(kind: YearCardKind, last = false): YearCard {
  const beats = BEATS[kind];
  return {
    kind,
    beats,
    duration: (beats + (last ? 0 : FILL_BEATS)) * BEAT,
    settle: Math.min(SETTLE_BEATS[kind], beats - 0.1) * BEAT,
  };
}
