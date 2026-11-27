import { describe, expect, it } from 'vitest';
import type { YearTypeId } from '../types';
import { pickYearType, type YearTypeMetrics } from './yearType';

/** A year that matches no rule. */
function metrics(overrides: Partial<YearTypeMetrics> = {}): YearTypeMetrics {
  return {
    drawers: 2,
    binsPlaced: 12,
    designs: 1,
    binDesigns: 1,
    maxCompartments: { count: 1, name: 'Plain' },
    longestPrint: { minutes: 90, name: 'Plain' },
    filamentGrams: 400,
    fillRatio: 0.6,
    biggestDrawerAreaMm2: 100_000,
    maxLayers: 1,
    favouriteSize: { width: 2, depth: 1, count: 5 },
    halfBins: false,
    labelledDesigns: 0,
    averageBinHeight: 3,
    remixes: 0,
    mostVersionedDesign: null,
    ...overrides,
  };
}

describe('pickYearType', () => {
  it('falls back to Standard Issue', () => {
    expect(pickYearType(metrics())).toEqual({ id: 'standardIssue', values: {} });
  });

  it.each([
    ['compartmentalist', { maxCompartments: { count: 9, name: 'Grid' } }],
    ['nightShift', { longestPrint: { minutes: 480, name: 'Tall' } }],
    ['spoolEater', { filamentGrams: 3000 }],
    ['gapFiller', { fillRatio: 0.95 }],
    ['customShop', { designs: 4, drawers: 1 }],
    ['architect', { maxLayers: 3 }],
    ['smallParts', { favouriteSize: { width: 1, depth: 1, count: 8 }, halfBins: true }],
    ['labelMaker', { binDesigns: 2, labelledDesigns: 1 }],
    ['minimalist', { drawers: 1, binsPlaced: 6 }],
    ['heavyDuty', { averageBinHeight: 9 }],
    ['remixer', { remixes: 2 }],
    ['measureTwice', { mostVersionedDesign: { days: 5, name: 'Again' } }],
  ] as const)('matches %s at its threshold', (id, overrides) => {
    expect(pickYearType(metrics(overrides)).id).toBe(id);
  });

  it('prefers the rule the user is furthest past', () => {
    const type = pickYearType(
      metrics({ maxCompartments: { count: 10, name: 'Grid' }, filamentGrams: 9000 })
    );
    expect(type).toEqual({ id: 'spoolEater', values: { grams: 9000 } });
  });

  it('keeps the earlier rule when both are saturated', () => {
    const type = pickYearType(
      metrics({ maxCompartments: { count: 30, name: 'Grid' }, filamentGrams: 20_000 })
    );
    expect(type.id).toBe('compartmentalist');
  });

  it('lets a yes-or-no type beat a numeric one that is only just over', () => {
    const type = pickYearType(
      metrics({
        filamentGrams: 3100,
        favouriteSize: { width: 1, depth: 1, count: 8 },
        halfBins: true,
      })
    );
    expect(type.id).toBe('smallParts');
  });

  it('needs enough bins before calling drawers full', () => {
    expect(pickYearType(metrics({ fillRatio: 1, binsPlaced: 3 })).id).toBe('standardIssue');
  });

  it('reports the larger architect reason', () => {
    const type = pickYearType(metrics({ biggestDrawerAreaMm2: 500_000, maxLayers: 3 }));
    expect(type).toEqual({ id: 'architect', values: { areaMm2: 500_000 } });
  });

  it('spreads realistic years over many types', () => {
    const years: Partial<YearTypeMetrics>[] = [
      { maxCompartments: { count: 16, name: 'Sorter' }, filamentGrams: 3400 },
      { longestPrint: { minutes: 720, name: 'Tower' }, filamentGrams: 3200 },
      { filamentGrams: 7000, fillRatio: 0.97 },
      { fillRatio: 1, binsPlaced: 40 },
      { designs: 9, drawers: 2, binDesigns: 9 },
      { biggestDrawerAreaMm2: 520_000, maxLayers: 2 },
      { favouriteSize: { width: 1, depth: 1, count: 30 }, halfBins: true, filamentGrams: 2000 },
      { binDesigns: 4, designs: 4, drawers: 4, labelledDesigns: 4 },
      { drawers: 1, binsPlaced: 8 },
      { averageBinHeight: 13, binsPlaced: 10 },
      { remixes: 5 },
      { mostVersionedDesign: { days: 12, name: 'Again' } },
      {},
    ];
    const ids = years.map((year) => pickYearType(metrics(year)).id);
    const counts = new Map<YearTypeId, number>();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    expect(counts.size).toBe(13);
  });
});
