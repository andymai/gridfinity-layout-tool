import type { ReactNode } from 'react';
import { Button } from '@/design-system';
import type { LayoutPreview } from '@/core/types';
import { useTranslation, type TFunction } from '@/i18n';
import type { LengthUnit } from '@/shared/utils/lengthUnit';
import { PIXEL_FONT } from '../../../components/CreditsRoll/creditsRollItems';
import type { YearStats } from '../../types';
import type { YearCard } from '../../utils/yearCards';
import { formatCount, pizzaBoxes, spools } from '../../utils/yearFormat';
import { readableAccent } from '../../utils/readableAccent';
import { cardCopy, summaryRows } from './cardCopy';
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
import { typeName } from './typeCopy';

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

interface Motion {
  readonly elapsed: number;
  readonly reduced: boolean;
  readonly accent: string;
}

interface CardBodyProps extends Omit<Motion, 'accent'> {
  readonly visual?: ReactNode;
  readonly kicker?: string;
  readonly title: string;
  readonly lines?: readonly string[];
  readonly accentText: string;
  readonly footer?: ReactNode;
}

function CardBody({
  visual,
  kicker,
  title,
  lines = [],
  accentText,
  elapsed,
  reduced,
  footer,
}: CardBodyProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-[1.6em] pb-[1.8em] pt-[0.8em]">
      <div className="flex min-h-0 flex-1 items-center justify-center">{visual}</div>
      <div>
        {kicker && (
          <p
            className="mb-[0.6em] text-[0.62em] uppercase tracking-[0.15em]"
            style={{ fontFamily: PIXEL_FONT, color: accentText, ...rise(elapsed, 0.1, reduced) }}
          >
            {kicker}
          </p>
        )}
        <h2
          className="text-[2em] font-bold leading-[1.1] tracking-tight tabular-nums"
          style={rise(elapsed, 0.2, reduced)}
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

interface SummaryCardProps extends Omit<Motion, 'accent'> {
  readonly rows: readonly [string, string][];
  readonly year: number;
  readonly accentText: string;
}

function SummaryCard({ rows, year, accentText, elapsed, reduced }: SummaryCardProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-[1.6em] pb-[1.8em]">
      <p
        className="mb-[1em] text-[2.6em] leading-none"
        style={{ fontFamily: PIXEL_FONT, color: accentText, ...rise(elapsed, 0.1, reduced) }}
      >
        {year}
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

interface VisualInput {
  readonly motion: Motion;
  readonly accentText: string;
  readonly stats: YearStats;
  readonly locale: string;
  readonly supporterCount: number;
  readonly drawerPreview: LayoutPreview | null;
  readonly t: TFunction;
}

function cardVisual(card: YearCard, input: VisualInput): ReactNode {
  const { motion, accentText, stats, locale, drawerPreview, t } = input;
  const { elapsed, reduced, accent } = motion;
  switch (card.kind) {
    case 'intro':
      return <IntroVisual {...motion} year={stats.year} />;
    case 'drawers':
      return <DrawerStack {...motion} count={stats.drawers} />;
    case 'bins':
      return <BinGrid {...motion} count={stats.binsPlaced} />;
    case 'area':
      return <BoxGrid {...motion} count={pizzaBoxes(stats.drawerAreaMm2)} />;
    case 'biggest':
      return drawerPreview && <DrawerPlan {...motion} preview={drawerPreview} />;
    case 'size':
      return (
        stats.favouriteSize && (
          <Footprint
            {...motion}
            width={stats.favouriteSize.width}
            depth={stats.favouriteSize.depth}
          />
        )
      );
    case 'designs':
      return (
        <ThumbGrid
          {...motion}
          thumbnails={stats.complexityShortlist.map((entry) => entry.thumbnail)}
        />
      );
    case 'month':
      return (
        stats.busiestMonth && (
          <MonthBars
            {...motion}
            counts={stats.monthCounts}
            busiest={stats.busiestMonth.month}
            locale={locale}
            year={stats.year}
          />
        )
      );
    case 'filament':
      return stats.filament && <SpoolRow {...motion} count={spools(stats.filament.grams)} />;
    case 'longest':
      return stats.longestPrint && <HeroThumb {...motion} src={stats.longestPrint.thumbnail} />;
    case 'exports':
      return <FileStack {...motion} count={stats.exports} />;
    case 'type':
      return <TypeBadge {...motion} accent={accentText} name={typeName(t, stats.type.id)} />;
    case 'thanks':
      return (
        <p
          className="text-[4.2em] font-bold leading-none tabular-nums"
          style={{
            color: accentText,
            textShadow: `0 0 0.5em ${accent}66`,
            ...rise(elapsed, 0.1, reduced),
          }}
          aria-hidden="true"
        >
          {formatCount(locale, countUp(input.supporterCount, elapsed, reduced))}
        </p>
      );
    case 'summary':
      return null;
  }
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
  const accentText = readableAccent(accent);
  const input = { t, stats, locale, unit, supporterCount };

  if (card.kind === 'summary') {
    return (
      <SummaryCard
        rows={summaryRows(input)}
        year={stats.year}
        accentText={accentText}
        elapsed={elapsed}
        reduced={reduced}
      />
    );
  }

  const copy = cardCopy(card.kind, {
    ...input,
    shown: (value) => countUp(value, elapsed, reduced),
  });
  if (!copy) return null;

  const footer =
    card.kind === 'thanks' ? (
      <div className="mt-[1.4em] flex flex-col gap-[0.6em]" style={rise(elapsed, 1.6, reduced)}>
        <Button variant="primary" size="lg" onClick={onRollCredits} className="w-full">
          {t('your2026.thanks.rollCredits')}
        </Button>
        <Button variant="secondary" size="lg" onClick={onSupport} className="w-full">
          {t('your2026.thanks.support')}
        </Button>
      </div>
    ) : undefined;

  return (
    <CardBody
      visual={cardVisual(card, {
        motion: { elapsed, reduced, accent },
        accentText,
        stats,
        locale,
        supporterCount,
        drawerPreview,
        t,
      })}
      kicker={copy.kicker}
      title={copy.title}
      lines={copy.lines}
      accentText={accentText}
      elapsed={elapsed}
      reduced={reduced}
      footer={footer}
    />
  );
}
