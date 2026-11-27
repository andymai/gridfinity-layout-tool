import type { ReactNode } from 'react';
import { Button } from '@/design-system';
import type { LayoutPreview } from '@/core/types';
import { useTranslation } from '@/i18n';
import type { LengthUnit } from '@/shared/utils/lengthUnit';
import { PIXEL_FONT } from '../../../components/CreditsRoll/creditsRollItems';
import type { YearStats } from '../../types';
import type { YearCard } from '../../utils/yearCards';
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
import { countUp, rise } from './cardMotion';
import {
  BinGrid,
  BoxGrid,
  DrawerPlan,
  DrawerStack,
  FileStack,
  Footprint,
  HeroThumb,
  IntroVisual,
  MonthBars,
  SpoolRow,
  ThumbGrid,
  TypeBadge,
} from './cardVisuals';
import { typeLine, typeName, typeReason } from './typeCopy';

const SITE_HOST = 'gridfinitylayouttool.com';

export interface YearCardViewProps {
  readonly card: YearCard;
  /** Seconds since the card began. */
  readonly elapsed: number;
  readonly stats: YearStats;
  readonly accent: string;
  readonly locale: string;
  readonly unit: LengthUnit;
  readonly reducedMotion: boolean;
  readonly supporterCount: number;
  readonly drawerPreview: LayoutPreview | null;
  readonly onRollCredits: () => void;
  readonly onSupport: () => void;
}

interface CardBodyProps {
  readonly visual?: ReactNode;
  readonly kicker?: string;
  readonly title: string;
  readonly lines?: readonly string[];
  readonly accent: string;
  readonly elapsed: number;
  readonly reduced: boolean;
  readonly titleFont?: 'pixel';
  readonly footer?: ReactNode;
}

function CardBody({
  visual,
  kicker,
  title,
  lines = [],
  accent,
  elapsed,
  reduced,
  titleFont,
  footer,
}: CardBodyProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-[1.6em] pb-[1.8em] pt-[0.8em]">
      <div className="flex min-h-0 flex-1 items-center justify-center">{visual}</div>
      <div>
        {kicker && (
          <p
            className="mb-[0.6em] text-[0.62em] uppercase tracking-[0.15em]"
            style={{ fontFamily: PIXEL_FONT, color: accent, ...rise(elapsed, 0.1, reduced) }}
          >
            {kicker}
          </p>
        )}
        <h2
          className={
            titleFont === 'pixel'
              ? 'text-[1.25em] uppercase leading-[1.5]'
              : 'text-[2em] font-bold leading-[1.1] tracking-tight tabular-nums'
          }
          style={{
            ...(titleFont === 'pixel' ? { fontFamily: PIXEL_FONT, color: accent } : {}),
            ...rise(elapsed, 0.2, reduced),
          }}
        >
          {title}
        </h2>
        {lines.map((line, index) => (
          <p
            key={line}
            className="mt-[0.5em] text-[1em] leading-snug text-white/70"
            style={rise(elapsed, 0.9 + index * 0.35, reduced)}
          >
            {line}
          </p>
        ))}
        {footer}
      </div>
    </div>
  );
}

export function YearCardView({
  card,
  elapsed,
  stats,
  accent,
  locale,
  unit,
  reducedMotion: reduced,
  supporterCount,
  drawerPreview,
  onRollCredits,
  onSupport,
}: YearCardViewProps) {
  const t = useTranslation();
  const motion = { elapsed, reduced, accent };
  const body = { accent, elapsed, reduced };

  switch (card.kind) {
    case 'intro':
      return (
        <CardBody
          {...body}
          visual={<IntroVisual {...motion} year={stats.year} />}
          title={t('your2026.intro.line')}
        />
      );
    case 'drawers': {
      const count = countUp(stats.drawers, elapsed, reduced);
      return (
        <CardBody
          {...body}
          visual={<DrawerStack {...motion} count={stats.drawers} />}
          title={t('your2026.drawers.title', { count })}
          lines={[t('your2026.drawers.line', { count: stats.drawers })]}
        />
      );
    }
    case 'bins': {
      const count = countUp(stats.binsPlaced, elapsed, reduced);
      return (
        <CardBody
          {...body}
          visual={<BinGrid {...motion} count={stats.binsPlaced} />}
          title={t('your2026.bins.title', { count })}
          lines={[t('your2026.bins.line', { count: stats.binsPlaced })]}
        />
      );
    }
    case 'area': {
      const boxes = pizzaBoxes(stats.drawerAreaMm2);
      const area = formatArea(locale, countUp(stats.drawerAreaMm2, elapsed, reduced), unit);
      return (
        <CardBody
          {...body}
          visual={<BoxGrid {...motion} count={boxes} />}
          title={t('your2026.area.title', { area })}
          lines={[t('your2026.area.line', { count: boxes })]}
        />
      );
    }
    case 'biggest': {
      const drawer = stats.biggestDrawer;
      if (!drawer) return null;
      return (
        <CardBody
          {...body}
          visual={drawerPreview && <DrawerPlan {...motion} preview={drawerPreview} />}
          title={t('your2026.biggest.title')}
          lines={[
            t('your2026.biggest.line', {
              size: formatSize(locale, drawer.widthMm, drawer.depthMm, unit),
              name: drawer.name,
            }),
          ]}
        />
      );
    }
    case 'size': {
      const size = stats.favouriteSize;
      if (!size) return null;
      return (
        <CardBody
          {...body}
          visual={<Footprint {...motion} width={size.width} depth={size.depth} />}
          title={t('your2026.size.title', {
            size: formatFootprint(locale, size.width, size.depth),
          })}
          lines={[t('your2026.size.line', { count: size.count })]}
        />
      );
    }
    case 'designs': {
      const count = countUp(stats.designs, elapsed, reduced);
      return (
        <CardBody
          {...body}
          visual={
            <ThumbGrid
              {...motion}
              thumbnails={stats.complexityShortlist.map((entry) => entry.thumbnail)}
            />
          }
          title={t('your2026.designs.title', { count })}
          lines={[t('your2026.designs.line')]}
        />
      );
    }
    case 'month': {
      const busiest = stats.busiestMonth;
      if (!busiest) return null;
      return (
        <CardBody
          {...body}
          visual={
            <MonthBars
              {...motion}
              counts={stats.monthCounts}
              busiest={busiest.month}
              locale={locale}
              year={stats.year}
            />
          }
          kicker={t('your2026.month.kicker')}
          title={monthName(locale, stats.year, busiest.month)}
          lines={[t('your2026.month.line', { count: busiest.count })]}
        />
      );
    }
    case 'filament': {
      const filament = stats.filament;
      if (!filament) return null;
      const weight = formatWeight(locale, countUp(filament.grams, elapsed, reduced));
      return (
        <CardBody
          {...body}
          visual={<SpoolRow {...motion} count={spools(filament.grams)} />}
          title={t('your2026.filament.title', { weight })}
          lines={[
            t('your2026.filament.spools', { count: spools(filament.grams) }),
            t('your2026.filament.hours', { count: printerHours(filament.printMinutes) }),
          ]}
        />
      );
    }
    case 'longest': {
      const longest = stats.longestPrint;
      if (!longest) return null;
      return (
        <CardBody
          {...body}
          visual={<HeroThumb {...motion} src={longest.thumbnail} />}
          title={t('your2026.longest.title', { time: formatDuration(locale, longest.minutes) })}
          lines={[t('your2026.longest.line', { name: longest.name })]}
        />
      );
    }
    case 'exports': {
      const count = countUp(stats.exports, elapsed, reduced);
      return (
        <CardBody
          {...body}
          visual={<FileStack {...motion} count={stats.exports} />}
          title={t('your2026.exports.title', { count })}
          lines={[t('your2026.exports.line')]}
        />
      );
    }
    case 'type': {
      const reason = typeReason(t, stats.type, locale, unit);
      return (
        <CardBody
          {...body}
          visual={<TypeBadge {...motion} name={typeName(t, stats.type.id)} />}
          kicker={t('your2026.type.kicker')}
          title={typeLine(t, stats.type.id)}
          lines={reason ? [reason] : []}
        />
      );
    }
    case 'summary': {
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
      return (
        <div className="flex min-h-0 flex-1 flex-col justify-center px-[1.6em] pb-[1.8em]">
          <p
            className="mb-[1em] text-[2.6em] leading-none"
            style={{ fontFamily: PIXEL_FONT, color: accent, ...rise(elapsed, 0.1, reduced) }}
          >
            {stats.year}
          </p>
          <dl className="flex flex-col gap-[0.7em]">
            {rows.map(([label, value], index) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-[1em] border-b border-white/10 pb-[0.5em]"
                style={rise(elapsed, 0.3 + index * 0.25, reduced)}
              >
                <dt className="text-[0.95em] text-white/60">{label}</dt>
                <dd className="text-right text-[1.3em] font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-[1.4em] text-[0.75em] text-white/40">{SITE_HOST}</p>
        </div>
      );
    }
    case 'thanks':
      return (
        <CardBody
          {...body}
          visual={
            <p
              className="text-[4.2em] font-bold leading-none tabular-nums"
              style={{
                color: accent,
                textShadow: `0 0 0.5em ${accent}66`,
                ...rise(elapsed, 0.1, reduced),
              }}
              aria-hidden="true"
            >
              {formatCount(locale, countUp(supporterCount, elapsed, reduced))}
            </p>
          }
          title={t('your2026.thanks.title', { count: supporterCount })}
          lines={[t('your2026.thanks.line')]}
          footer={
            <div
              className="mt-[1.4em] flex flex-col gap-[0.6em]"
              style={rise(elapsed, 1.6, reduced)}
            >
              <Button variant="primary" size="lg" onClick={onRollCredits} className="w-full">
                {t('your2026.thanks.rollCredits')}
              </Button>
              <Button variant="secondary" size="lg" onClick={onSupport} className="w-full">
                {t('your2026.thanks.support')}
              </Button>
            </div>
          }
        />
      );
  }
}
