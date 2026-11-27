import { Component, Suspense, type ReactNode } from 'react';
import { Button } from '@/design-system';
import type { LayoutPreview } from '@/core/types';
import { useTranslation, type TFunction } from '@/i18n';
import type { LengthUnit } from '@/shared/utils/lengthUnit';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
import { detectWebGL, markWebGLUnavailable, webglFailureReason } from '@/shared/webgl/detectWebGL';
import type { YearMesh } from '../../hooks/useYearMeshes';
import { canSpin } from '../SpinningBin/assembly';
import type { ComplicatedPick } from '../../utils/complicatedPick';
import { PIXEL_FONT } from '../../../components/CreditsRoll/creditsRollItems';
import type { YearStats } from '../../types';
import type { YearCard } from '../../utils/yearCards';
import { formatCount, pizzaBoxes, spools } from '../../utils/yearFormat';
import { readableAccent } from '../../utils/readableAccent';
import { cardCopy, summaryRows } from './cardCopy';
import { countUp, fraction, rise } from './cardMotion';
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

/** Lazy, so a device with no mesh never downloads the 3D viewer. */
const SpinningBin = lazyWithRetry(() => import('../SpinningBin').then(namedExport('SpinningBin')));

interface BinShowcaseProps {
  readonly mesh: YearMesh | undefined;
  readonly thumbnail: string | null;
  readonly name: string;
  readonly elapsed: number;
  readonly reduced: boolean;
  readonly accent: string;
}

interface ShowcaseBoundaryProps {
  readonly fallback: ReactNode;
  readonly children: ReactNode;
}

/**
 * The turning bin is decoration, so a canvas that cannot get a WebGL context
 * (or a viewer chunk that fails to load) falls back to the thumbnail instead
 * of taking the story down. A WebGL failure also marks WebGL unavailable, so
 * the next card skips the canvas.
 */
class ShowcaseBoundary extends Component<ShowcaseBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    const reason = webglFailureReason(error.message, error.stack);
    if (reason !== null) markWebGLUnavailable(reason);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** The saved thumbnail until the mesh is ready, then the real bin turning. */
function BinShowcase({ mesh, thumbnail, name, elapsed, reduced, accent }: BinShowcaseProps) {
  const thumb = <HeroThumb elapsed={elapsed} reduced={reduced} accent={accent} src={thumbnail} />;
  if (!mesh || !canSpin(mesh) || !detectWebGL().available) return thumb;
  return (
    <div
      className="h-[18em] w-[18em]"
      style={{
        opacity: fraction(elapsed, 0.2, 0.9, reduced),
        filter: `drop-shadow(0 0 2em ${accent}33)`,
      }}
    >
      <ShowcaseBoundary fallback={thumb}>
        <Suspense fallback={thumb}>
          <SpinningBin
            mesh={mesh.mesh}
            restOffset={mesh.restOffset}
            turnSeconds={reduced ? 0 : elapsed}
            label={name}
          />
        </Suspense>
      </ShowcaseBoundary>
    </div>
  );
}

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
  readonly meshes: ReadonlyMap<string, YearMesh>;
  readonly complicated: ComplicatedPick | null;
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
  readonly meshes: ReadonlyMap<string, YearMesh>;
  readonly complicated: ComplicatedPick | null;
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
      return (
        stats.longestPrint && (
          <BinShowcase
            {...motion}
            mesh={input.meshes.get(stats.longestPrint.id)}
            thumbnail={stats.longestPrint.thumbnail}
            name={stats.longestPrint.name}
          />
        )
      );
    case 'complicated':
      return (
        input.complicated && (
          <BinShowcase
            {...motion}
            mesh={input.meshes.get(input.complicated.design.id)}
            thumbnail={input.complicated.design.thumbnail}
            name={input.complicated.design.name}
          />
        )
      );
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
  meshes,
  complicated,
  onRollCredits,
  onSupport,
}: YearCardViewProps) {
  const t = useTranslation();
  const accentText = readableAccent(accent);
  const input = { t, stats, locale, unit, supporterCount, complicated };

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
        meshes,
        complicated,
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
