import type { YearType, YearTypeId } from '../types';

/** The numbers the type rules read, gathered once by `computeYearStats`. */
export interface YearTypeMetrics {
  readonly drawers: number;
  readonly binsPlaced: number;
  readonly designs: number;
  readonly binDesigns: number;
  readonly maxCompartments: { readonly count: number; readonly name: string } | null;
  readonly longestPrint: { readonly minutes: number; readonly name: string } | null;
  readonly filamentGrams: number;
  /** Average share of each drawer's bottom layer that bins cover, 0 to 1. */
  readonly fillRatio: number | null;
  readonly biggestDrawerAreaMm2: number;
  readonly maxLayers: number;
  readonly favouriteSize: {
    readonly width: number;
    readonly depth: number;
    readonly count: number;
  } | null;
  readonly halfBins: boolean;
  readonly labelledDesigns: number;
  /** Average height of the placed bins, in height units. */
  readonly averageBinHeight: number | null;
  readonly remixes: number;
  /** The design with versions saved on the most different days of the year. */
  readonly mostVersionedDesign: { readonly days: number; readonly name: string } | null;
}

interface Match {
  readonly id: YearTypeId;
  /** 1 at the threshold, 2 at saturation, so every rule competes on one scale. */
  readonly strength: number;
  readonly values: YearType['values'];
}

type Rule = (m: YearTypeMetrics) => Match | null;

/** A yes-or-no rule beats a numeric one that is only just over its threshold. */
const FLAT_STRENGTH = 1.5;

function scaled(
  id: YearTypeId,
  value: number,
  threshold: number,
  saturation: number,
  values: YearType['values']
): Match | null {
  if (value < threshold) return null;
  const progress = Math.min(1, (value - threshold) / (saturation - threshold));
  return { id, strength: 1 + progress, values };
}

function flat(id: YearTypeId, matches: boolean, values: YearType['values']): Match | null {
  return matches ? { id, strength: FLAT_STRENGTH, values } : null;
}

function stronger(a: Match | null, b: Match | null): Match | null {
  if (!a) return b;
  if (!b) return a;
  return b.strength > a.strength ? b : a;
}

/** Order breaks ties, so a rarer type sits above a broader one. */
const RULES: readonly Rule[] = [
  (m) =>
    m.maxCompartments &&
    scaled('compartmentalist', m.maxCompartments.count, 9, 24, {
      count: m.maxCompartments.count,
      name: m.maxCompartments.name,
    }),
  (m) =>
    m.longestPrint &&
    scaled('nightShift', m.longestPrint.minutes, 8 * 60, 16 * 60, {
      minutes: m.longestPrint.minutes,
      name: m.longestPrint.name,
    }),
  (m) => scaled('spoolEater', m.filamentGrams, 3000, 8000, { grams: m.filamentGrams }),
  (m) =>
    m.fillRatio !== null && m.binsPlaced >= 4
      ? scaled('gapFiller', m.fillRatio, 0.95, 1, { percent: Math.round(m.fillRatio * 100) })
      : null,
  (m) =>
    m.designs >= 3 && m.designs > m.drawers
      ? scaled('customShop', m.designs / Math.max(1, m.drawers), 1, 4, { count: m.designs })
      : null,
  (m) =>
    stronger(
      scaled('architect', m.biggestDrawerAreaMm2, 250_000, 600_000, {
        areaMm2: m.biggestDrawerAreaMm2,
      }),
      scaled('architect', m.maxLayers, 3, 6, { count: m.maxLayers })
    ),
  (m) =>
    flat('smallParts', m.favouriteSize?.width === 1 && m.favouriteSize.depth === 1 && m.halfBins, {
      count: m.favouriteSize?.count ?? 0,
    }),
  (m) =>
    m.binDesigns >= 2
      ? scaled('labelMaker', m.labelledDesigns / m.binDesigns, 0.5, 1, {
          count: m.labelledDesigns,
        })
      : null,
  (m) =>
    flat('minimalist', m.drawers === 1 && m.binsPlaced >= 1 && m.binsPlaced <= 10, {
      count: m.binsPlaced,
    }),
  (m) =>
    m.averageBinHeight !== null && m.binsPlaced >= 3
      ? scaled('heavyDuty', m.averageBinHeight, 9, 15, { count: Math.round(m.averageBinHeight) })
      : null,
  (m) => scaled('remixer', m.remixes, 2, 6, { count: m.remixes }),
  (m) =>
    m.mostVersionedDesign &&
    scaled('measureTwice', m.mostVersionedDesign.days, 5, 15, {
      count: m.mostVersionedDesign.days,
      name: m.mostVersionedDesign.name,
    }),
];

export function pickYearType(metrics: YearTypeMetrics): YearType {
  let best: Match | null = null;
  for (const rule of RULES) {
    const match = rule(metrics);
    if (match && (!best || match.strength > best.strength)) best = match;
  }
  return best ? { id: best.id, values: best.values } : { id: 'standardIssue', values: {} };
}
