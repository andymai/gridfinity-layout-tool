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
  /** Seconds on screen before the next card. */
  readonly duration: number;
}

const DURATION: Readonly<Record<YearCardKind, number>> = {
  intro: 4,
  drawers: 5.5,
  bins: 5.5,
  area: 5.5,
  biggest: 6,
  size: 5.5,
  designs: 5.5,
  month: 6,
  filament: 6.5,
  longest: 6,
  complicated: 6.5,
  exports: 5,
  type: 7.5,
  summary: 7,
  thanks: 8,
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
  return (Object.keys(DURATION) as YearCardKind[])
    .filter((kind) => shown[kind])
    .map((kind) => ({ kind, duration: DURATION[kind] }));
}
