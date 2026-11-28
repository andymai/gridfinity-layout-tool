import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { YearStats } from '../types';
import { buildYearCards } from './yearCards';

const full: YearStats = {
  year: 2026,
  drawers: 3,
  binsPlaced: 40,
  drawerAreaMm2: 400_000,
  biggestDrawer: { layoutId: 'l1', name: 'Workbench', widthMm: 600, depthMm: 450 },
  favouriteSize: { width: 1, depth: 1, count: 12 },
  designs: 4,
  busiestMonth: { month: 2, count: 3 },
  monthCounts: [0, 0, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  filament: { grams: 2400, printMinutes: 4000 },
  longestPrint: {
    id: 'd1',
    name: 'Caddy',
    thumbnail: null,
    params: DEFAULT_BIN_PARAMS,
    minutes: 300,
  },
  complexityShortlist: [],
  exports: 9,
  type: { id: 'standardIssue', values: {} },
};

describe('buildYearCards', () => {
  it('plays every card for a full year, ending on the summary and the thanks', () => {
    expect(buildYearCards(full).map((card) => card.kind)).toEqual([
      'intro',
      'drawers',
      'bins',
      'area',
      'biggest',
      'size',
      'designs',
      'month',
      'filament',
      'longest',
      'exports',
      'type',
      'summary',
      'thanks',
    ]);
  });

  it('adds the most complicated card after the longest print when there are bin designs', () => {
    const withShortlist: YearStats = {
      ...full,
      complexityShortlist: [
        { id: 'd2', name: 'Grid', thumbnail: null, params: DEFAULT_BIN_PARAMS, score: 9 },
      ],
    };
    const kinds = buildYearCards(withShortlist).map((card) => card.kind);
    expect(kinds.indexOf('complicated')).toBe(kinds.indexOf('longest') + 1);
  });

  it('holds each card for its beats at 88 BPM, with a one-beat fill after all but the last', () => {
    const cards = buildYearCards(full);
    const beat = 60 / 88;
    const intro = cards[0];
    const thanks = cards.at(-1);
    expect(intro?.beats).toBe(7);
    expect(intro?.duration).toBeCloseTo(8 * beat);
    expect(thanks?.kind).toBe('thanks');
    expect(thanks?.duration).toBeCloseTo(8 * beat);
    for (const card of cards) {
      expect(card.settle).toBeGreaterThan(0);
      expect(card.settle).toBeLessThan(card.beats * beat);
    }
  });

  it('leaves out cards with no numbers behind them', () => {
    const designsOnly: YearStats = {
      ...full,
      drawers: 0,
      binsPlaced: 0,
      drawerAreaMm2: 0,
      biggestDrawer: null,
      favouriteSize: null,
      busiestMonth: null,
      exports: 0,
    };
    expect(buildYearCards(designsOnly).map((card) => card.kind)).toEqual([
      'intro',
      'designs',
      'filament',
      'longest',
      'type',
      'summary',
      'thanks',
    ]);
  });
});
