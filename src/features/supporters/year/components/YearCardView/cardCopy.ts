import type { TFunction } from '@/i18n';
import type { LengthUnit } from '@/shared/utils/lengthUnit';
import type { YearStats } from '../../types';
import type { ComplicatedPick } from '../../utils/complicatedPick';
import type { YearCard, YearCardKind } from '../../utils/yearCards';
import {
  formatArea,
  formatCount,
  formatDuration,
  formatFootprint,
  formatSize,
  formatWeight,
  monthName,
  pizzaBoxes,
  printerHours,
  spools,
} from '../../utils/yearFormat';
import { typeLine, typeName, typeReason } from './typeCopy';

export interface CardCopy {
  readonly kicker?: string;
  readonly title: string;
  readonly lines: readonly string[];
  /** The type card sets its title in the pixel font. */
  readonly pixelTitle?: boolean;
}

export interface CopyContext {
  readonly t: TFunction;
  readonly locale: string;
  readonly unit: LengthUnit;
  readonly stats: YearStats;
  readonly supporterCount: number;
  readonly complicated: ComplicatedPick | null;
  /** The number to show now: a count-up on screen, the final value in a share image. */
  readonly shown: (value: number) => number;
}

/** The words on a card, shared by the card on screen and its share image. */
export function cardCopy(kind: YearCardKind, ctx: CopyContext): CardCopy | null {
  const { t, locale, unit, stats, shown } = ctx;
  switch (kind) {
    case 'intro':
      return { title: t('your2026.intro.line'), lines: [] };
    case 'drawers': {
      const count = shown(stats.drawers);
      return {
        title: t('your2026.drawers.title', { count }),
        lines: [t('your2026.drawers.line', { count: stats.drawers })],
      };
    }
    case 'bins': {
      const count = shown(stats.binsPlaced);
      return {
        title: t('your2026.bins.title', { count }),
        lines: [t('your2026.bins.line', { count: stats.binsPlaced })],
      };
    }
    case 'area': {
      const area = formatArea(locale, shown(stats.drawerAreaMm2), unit);
      return {
        title: t('your2026.area.title', { area }),
        lines: [t('your2026.area.line', { count: pizzaBoxes(stats.drawerAreaMm2) })],
      };
    }
    case 'biggest': {
      const drawer = stats.biggestDrawer;
      if (!drawer) return null;
      const size = formatSize(locale, drawer.widthMm, drawer.depthMm, unit);
      return {
        title: t('your2026.biggest.title'),
        lines: [t('your2026.biggest.line', { size, name: drawer.name })],
      };
    }
    case 'size': {
      const favourite = stats.favouriteSize;
      if (!favourite) return null;
      const size = formatFootprint(locale, favourite.width, favourite.depth);
      return {
        title: t('your2026.size.title', { size }),
        lines: [t('your2026.size.line', { count: favourite.count })],
      };
    }
    case 'designs': {
      const count = shown(stats.designs);
      return {
        title: t('your2026.designs.title', { count }),
        lines: [t('your2026.designs.line')],
      };
    }
    case 'month': {
      const busiest = stats.busiestMonth;
      if (!busiest) return null;
      return {
        kicker: t('your2026.month.kicker'),
        title: monthName(locale, stats.year, busiest.month),
        lines: [t('your2026.month.line', { count: busiest.count })],
      };
    }
    case 'filament': {
      const filament = stats.filament;
      if (!filament) return null;
      const weight = formatWeight(locale, shown(filament.grams));
      return {
        title: t('your2026.filament.title', { weight }),
        lines: [
          t('your2026.filament.spools', { count: spools(filament.grams) }),
          t('your2026.filament.hours', { count: printerHours(filament.printMinutes) }),
        ],
      };
    }
    case 'longest': {
      const longest = stats.longestPrint;
      if (!longest) return null;
      const time = formatDuration(locale, longest.minutes);
      return {
        title: t('your2026.longest.title', { time }),
        lines: [t('your2026.longest.line', { name: longest.name })],
      };
    }
    case 'complicated': {
      const pick = ctx.complicated;
      if (!pick) return null;
      const name = pick.design.name;
      const triangles = pick.triangles === null ? null : formatCount(locale, pick.triangles);
      return {
        title: t('your2026.complicated.title', { name }),
        lines: [
          triangles === null
            ? t('your2026.complicated.lineNoCount')
            : t('your2026.complicated.line', { triangles }),
        ],
      };
    }
    case 'exports': {
      const count = shown(stats.exports);
      return {
        title: t('your2026.exports.title', { count }),
        lines: [t('your2026.exports.line')],
      };
    }
    case 'type': {
      const reason = typeReason(t, stats.type, locale, unit);
      return {
        kicker: t('your2026.type.kicker'),
        title: typeLine(t, stats.type.id),
        lines: reason ? [reason] : [],
      };
    }
    case 'summary':
      return { title: String(stats.year), lines: [] };
    case 'thanks': {
      const count = ctx.supporterCount;
      return {
        title: t('your2026.thanks.title', { count }),
        lines: [t('your2026.thanks.line')],
      };
    }
  }
}

/** The summary card's rows, label first. */
export function summaryRows(ctx: Omit<CopyContext, 'shown'>): [string, string][] {
  const { t, locale, stats } = ctx;
  const rows: [string, string][] = [];
  if (stats.drawers > 0)
    rows.push([t('your2026.summary.drawers'), formatCount(locale, stats.drawers)]);
  if (stats.binsPlaced > 0)
    rows.push([t('your2026.summary.bins'), formatCount(locale, stats.binsPlaced)]);
  if (stats.designs > 0)
    rows.push([t('your2026.summary.designs'), formatCount(locale, stats.designs)]);
  if (stats.filament) {
    rows.push([
      t('your2026.summary.printerTime'),
      formatDuration(locale, stats.filament.printMinutes),
    ]);
  }
  rows.push([t('your2026.summary.type'), typeName(t, stats.type.id)]);
  return rows;
}

export interface CopyInput {
  readonly t: TFunction;
  readonly stats: YearStats;
  readonly locale: string;
  readonly unit: LengthUnit;
  readonly supporterCount: number;
  readonly complicated: ComplicatedPick | null;
}

/** The card's final words in one line, for the screen-reader announcement. */
export function describeCard(card: YearCard, input: CopyInput): string {
  if (card.kind === 'summary') {
    return [String(input.stats.year), ...summaryRows(input).map((row) => row.join(': '))].join(
      '. '
    );
  }
  const copy = cardCopy(card.kind, { ...input, shown: (value) => value });
  if (!copy) return '';
  // On screen the type's name is the badge, which is not part of the copy.
  const name = card.kind === 'type' ? typeName(input.t, input.stats.type.id) : undefined;
  return [copy.kicker, name, copy.title, ...copy.lines].filter(Boolean).join(' ');
}
