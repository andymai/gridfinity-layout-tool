import { gridUnits, heightUnits } from '@gridfinity/branded-types';
import type { LayoutPreview } from '@/core/types';
import type { TFunction } from '@/i18n';
import { interpolate } from '@/i18n/interpolate';
import en from '@/i18n/locales/en';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { FontSpec, Measure } from '../look/typeset';
import type { YearStats } from '../types';
import { yearCard, type YearCardKind } from '../utils/yearCards';
import type { SceneInput } from './scene';

const strings = en as Readonly<Partial<Record<string, string>>>;

/** English with the plural forms the copy uses, as the app's provider resolves them. */
export const pluralT = ((key: string, vars?: Record<string, string | number>) => {
  const count = vars?.count;
  const form =
    typeof count === 'number' ? strings[`${key}_${count === 1 ? 'one' : 'other'}`] : undefined;
  return interpolate(form ?? strings[key] ?? key, vars);
}) as TFunction;

/**
 * A measure that reads text as a condensed display face would, without a
 * canvas: each character is about half its size wide, a CJK one a full em.
 */
export const roughMeasure: Measure = (text: string, font: FontSpec) => {
  let em = 0;
  for (const char of text)
    em += /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(char)
      ? 1
      : 0.5;
  return em * font.size;
};

export const sampleStats: YearStats = {
  year: 2026,
  drawers: 6,
  binsPlaced: 148,
  drawerAreaMm2: 1_402_000,
  biggestDrawer: { layoutId: 'l1', name: 'Workbench', widthMm: 966, depthMm: 798 },
  favouriteSize: { width: 1, depth: 1, count: 57 },
  designs: 34,
  busiestMonth: { month: 9, count: 19 },
  monthCounts: [2, 1, 4, 3, 2, 5, 3, 4, 7, 19, 9, 4],
  filament: { grams: 10_240, printMinutes: 26_400 },
  longestPrint: {
    id: 'knife',
    name: 'Knife Block',
    thumbnail: null,
    params: DEFAULT_BIN_PARAMS,
    minutes: 1640,
  },
  complexityShortlist: [
    { id: 'tray', name: 'Engraved Tray', thumbnail: null, params: DEFAULT_BIN_PARAMS, score: 17 },
  ],
  exports: 64,
  type: { id: 'nightShift', values: { name: 'Knife Block', minutes: 1640 } },
};

export function drawerPreview(
  width: number,
  depth: number,
  bins: readonly (readonly [number, number, number, number, string])[]
): LayoutPreview {
  return {
    drawerWidth: gridUnits(width),
    drawerDepth: gridUnits(depth),
    drawerHeight: heightUnits(6),
    binCount: bins.length,
    layerCount: 1,
    binMap: bins.map(([x, y, w, d, c]) => ({
      x: gridUnits(x),
      y: gridUnits(y),
      w: gridUnits(w),
      d: gridUnits(d),
      c,
    })),
  };
}

export function sceneInput(kind: YearCardKind, overrides: Partial<SceneInput> = {}): SceneInput {
  const stats = overrides.stats ?? sampleStats;
  return {
    card: yearCard(kind),
    t: pluralT,
    locale: 'en',
    unit: 'mm',
    stats,
    supporterCount: 50,
    complicated: stats.complexityShortlist[0]
      ? { design: stats.complexityShortlist[0], triangles: 8010 }
      : null,
    drawerPreview: drawerPreview(23, 19, [
      [0, 0, 3, 2, '#ef4444'],
      [3, 0, 1, 1, '#3b82f6'],
    ]),
    measure: roughMeasure,
    ...overrides,
  };
}
