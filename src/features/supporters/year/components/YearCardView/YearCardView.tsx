import {
  Component,
  Fragment,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Button } from '@/design-system';
import type { LayoutPreview } from '@/core/types';
import { useTranslation } from '@/i18n';
import type { LengthUnit } from '@/shared/utils/lengthUnit';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
import { detectWebGL, markWebGLUnavailable, webglFailureReason } from '@/shared/webgl/detectWebGL';
import { buildScene } from '../../cards/buildScene';
import { THUMB_SIZE, drawTinted } from '../../cards/paint';
import { PRINT_SPAN, PRINT_START, modelPose } from '../../cards/modelScenes';
import { CARD_H, CARD_W, type ModelSlot, type Scene, type TextBlock } from '../../cards/scene';
import { TEXT, familyFor } from '../../look/fonts';
import { enterPose, fadeAt, poseTransform } from '../../look/motion';
import type { Measure } from '../../look/typeset';
import type { YearMesh } from '../../hooks/useYearMeshes';
import type { YearStats } from '../../types';
import type { ComplicatedPick } from '../../utils/complicatedPick';
import type { YearCard } from '../../utils/yearCards';
import { useFrameSize } from '../CardFrame';
import { loadImage } from '../../utils/loadImage';
import { canSpin } from '../SpinningBin/assembly';
import { cardCopy, summaryEntries } from './cardCopy';
import { loadSpinningBin } from './spinningBinChunk';
import { typeName } from './typeCopy';

/** Lazy, so a device with no mesh never downloads the 3D viewer. */
const SpinningBin = lazyWithRetry(() => loadSpinningBin().then(namedExport('SpinningBin')));

const PRINT_TIMING = { start: PRINT_START, span: PRINT_SPAN };
/** The × between two numbers is set in the text face; every font has it, so any locale works. */
const TIMES_STYLE: CSSProperties = { fontFamily: familyFor(TEXT, 'en') };

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

/** A drawn bin in the card's tint, for a design with no thumbnail yet. */
function BinGlyph({ tint, edge }: { readonly tint: string; readonly edge: string }) {
  return (
    <svg viewBox="0 0 120 120" className="h-[60%] w-[60%]" aria-hidden="true">
      <rect x="14" y="20" width="92" height="22" rx="8" fill={tint} opacity="0.7" />
      <rect x="22" y="25" width="76" height="12" rx="4" fill={edge} opacity="0.35" />
      <rect x="14" y="36" width="92" height="64" rx="5" fill={tint} />
      <rect x="22" y="100" width="76" height="10" rx="3" fill={edge} opacity="0.5" />
    </svg>
  );
}

/** The saved thumbnail tinted into the card, so the stand-in matches the 3D bin it replaces. */
function TintedThumb({
  src,
  tint,
  resolution,
}: {
  readonly src: string;
  readonly tint: string;
  readonly resolution: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadImage(src).then(
      (next) => {
        if (!cancelled) setImage(next);
      },
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, [src]);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas || !image) return;
    const size = Math.max(1, Math.round(THUMB_SIZE * resolution));
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(resolution, 0, 0, resolution, 0, 0);
    drawTinted(ctx, image, 0, 0, THUMB_SIZE, THUMB_SIZE, tint);
  }, [image, tint, resolution]);
  return <canvas ref={ref} style={{ width: THUMB_SIZE, height: THUMB_SIZE }} />;
}

interface ModelViewProps {
  readonly slot: ModelSlot;
  readonly mesh: YearMesh | undefined;
  readonly thumbnail: string | null;
  readonly name: string;
  readonly elapsed: number;
  readonly reduced: boolean;
}

/** The real bin in its slot: the turning mesh, or the thumbnail until it can turn. */
function ModelView({ slot, mesh, thumbnail, name, elapsed, reduced }: ModelViewProps) {
  const { resolution } = useFrameSize();
  const pose = modelPose(slot, elapsed, reduced);
  // A thumbnail cannot print, so it fades in where the print would begin.
  const stillOpacity = slot.kind === 'print' ? fadeAt(elapsed, PRINT_START, 0.45) : 1;
  const still = (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ opacity: stillOpacity }}
    >
      {thumbnail ? (
        <TintedThumb src={thumbnail} tint={slot.look.tint} resolution={resolution} />
      ) : (
        <BinGlyph tint={slot.look.tint} edge={slot.look.edge} />
      )}
    </div>
  );
  const spins = mesh !== undefined && canSpin(mesh) && detectWebGL().available;
  const style: CSSProperties = {
    left: slot.x,
    top: slot.y,
    width: slot.w,
    height: slot.h,
    opacity: pose.opacity,
    transform: pose.transform,
    transformOrigin: slot.origin,
  };
  return (
    <div className="absolute" style={style} data-year-model="">
      {spins ? (
        <ShowcaseBoundary fallback={still}>
          <Suspense fallback={still}>
            <SpinningBin
              mesh={mesh.mesh}
              restOffset={mesh.restOffset}
              label={name}
              look={slot.look}
              angle={pose.angle}
              printTime={pose.printTime}
              printTiming={slot.kind === 'print' ? PRINT_TIMING : undefined}
              resolution={resolution}
            />
          </Suspense>
        </ShowcaseBoundary>
      ) : (
        still
      )}
    </div>
  );
}

/** The scene's drawing, redrawn only while something on it still moves. */
function SceneCanvas({
  scene,
  elapsed,
  reduced,
}: {
  readonly scene: Scene;
  readonly elapsed: number;
  readonly reduced: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { resolution } = useFrameSize();
  const t = Math.min(elapsed, scene.still);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const width = Math.max(1, Math.round(CARD_W * resolution));
    const height = Math.max(1, Math.round(CARD_H * resolution));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(resolution, 0, 0, resolution, 0, 0);
    scene.draw({ ctx, t, reduced, resolution });
  }, [scene, t, reduced, resolution]);
  return (
    <canvas ref={ref} className="absolute left-0 top-0" style={{ width: CARD_W, height: CARD_H }} />
  );
}

function lineContent(line: string, times: boolean | undefined): ReactNode {
  if (!times || !line.includes('×')) return line;
  return line.split('×').map((part, index) => (
    <Fragment key={index}>
      {index > 0 && (
        <span
          className="relative top-[-0.1em] mx-[0.1em] text-[0.74em] font-semibold"
          style={TIMES_STYLE}
        >
          ×
        </span>
      )}
      {part}
    </Fragment>
  ));
}

function TextView({
  block,
  elapsed,
  reduced,
}: {
  readonly block: TextBlock;
  readonly elapsed: number;
  readonly reduced: boolean;
}) {
  const pose =
    block.enter < 0
      ? null
      : enterPose(elapsed, reduced ? block.reduceEnter : block.enter, block.rise, reduced);
  return (
    <div
      className="absolute"
      style={{
        left: block.x,
        top: block.y,
        width: block.width,
        fontFamily: block.font.family,
        fontWeight: block.font.weight,
        fontSize: block.font.size,
        lineHeight: `${block.font.lineHeight}px`,
        letterSpacing: block.font.tracking ? `${block.font.tracking}em` : undefined,
        color: block.color,
        opacity: pose?.opacity,
        transform: pose && pose.y !== 0 ? `translateY(${pose.y.toFixed(2)}px)` : undefined,
      }}
    >
      {block.lines.map((line, index) => (
        <span key={index} className="block whitespace-nowrap">
          {lineContent(line, block.times)}
        </span>
      ))}
    </div>
  );
}

interface ThanksKeysProps {
  readonly y: number;
  readonly enter: readonly [number, number];
  readonly elapsed: number;
  readonly reduced: boolean;
  readonly locale: string;
  readonly onRollCredits: () => void;
  readonly onSupport: () => void;
}

const PRIMARY = {
  '--key-face': '#D4FF38',
  '--key-hover': '#E2FF6E',
  '--key-ink': '#121A5C',
  '--key-lip': '#EBFF9A',
  '--key-wall': '#8FB314',
} as CSSProperties;
const SECONDARY = {
  '--key-face': '#4A55F0',
  '--key-hover': '#5C66FF',
  '--key-ink': '#FFFFFF',
  '--key-lip': '#6E78FF',
  '--key-wall': '#161E8C',
} as CSSProperties;

/** The thank-you card's two buttons, as toy keys that sink when pressed. */
function ThanksKeys({
  y,
  enter,
  elapsed,
  reduced,
  locale,
  onRollCredits,
  onSupport,
}: ThanksKeysProps) {
  const t = useTranslation();
  const keys = [
    { label: t('your2026.thanks.rollCredits'), onClick: onRollCredits, look: PRIMARY },
    { label: t('your2026.thanks.support'), onClick: onSupport, look: SECONDARY },
  ];
  const reducedAt = [2.5, 3].map((beats) => (beats * 60) / 88);
  return (
    <>
      {keys.map((key, index) => {
        const start = reduced ? (reducedAt[index] ?? 0) : (enter[index] ?? 0);
        const pose = enterPose(elapsed, start, 30, reduced);
        return (
          <div
            key={key.label}
            className="y26-key"
            style={{
              ...key.look,
              left: 60,
              top: y + index * 170,
              width: 960,
              height: 150,
              opacity: pose.opacity,
              transform: poseTransform(pose),
              // Before it rises in, a tap there advances the card; keys and screen readers still reach it.
              pointerEvents: pose.opacity > 0.05 ? undefined : 'none',
            }}
          >
            <div className="y26-key-wall" aria-hidden="true" />
            <Button
              variant="ghost"
              className="y26-key-face"
              style={{ fontFamily: familyFor(TEXT, locale) }}
              onClick={key.onClick}
            >
              {key.label}
            </Button>
          </div>
        );
      })}
    </>
  );
}

export interface YearCardViewProps {
  readonly card: YearCard;
  /** Seconds since the card began. */
  readonly elapsed: number;
  readonly stats: YearStats;
  readonly locale: string;
  readonly unit: LengthUnit;
  readonly reducedMotion: boolean;
  readonly supporterCount: number;
  readonly drawerPreview: LayoutPreview | null;
  readonly meshes: ReadonlyMap<string, YearMesh>;
  readonly complicated: ComplicatedPick | null;
  readonly measure: Measure;
  /** While the first card's colour fills in, the card is there for screen readers only. */
  readonly hidden?: boolean;
  readonly onRollCredits: () => void;
  readonly onSupport: () => void;
}

/** The words of the card, whole, for screen readers; the drawn copy is split across type roles. */
function CardWords({
  card,
  input,
}: {
  readonly card: YearCard;
  readonly input: Parameters<typeof cardCopy>[1];
}) {
  if (card.kind === 'summary') {
    return (
      <div className="sr-only">
        <h2>{String(input.stats.year)}</h2>
        <dl>
          {summaryEntries(input).map((entry) => (
            <div key={entry.kind}>
              <dt>{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }
  const copy = cardCopy(card.kind, input);
  if (!copy) return null;
  return (
    <div className="sr-only">
      {copy.kicker && <p>{copy.kicker}</p>}
      {card.kind === 'type' && <p>{typeName(input.t, input.stats.type.id)}</p>}
      <h2>{copy.title}</h2>
      {copy.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

export function YearCardView({
  card,
  elapsed,
  stats,
  locale,
  unit,
  reducedMotion: reduced,
  supporterCount,
  drawerPreview,
  meshes,
  complicated,
  measure,
  hidden = false,
  onRollCredits,
  onSupport,
}: YearCardViewProps) {
  const t = useTranslation();
  const scene = useMemo(
    () =>
      buildScene({
        card,
        t,
        locale,
        unit,
        stats,
        supporterCount,
        complicated,
        drawerPreview,
        measure,
      }),
    [card, t, locale, unit, stats, supporterCount, complicated, drawerPreview, measure]
  );
  const copyInput = {
    t,
    locale,
    unit,
    stats,
    supporterCount,
    complicated,
    shown: (value: number) => value,
  };
  const modelSource =
    card.kind === 'longest'
      ? stats.longestPrint
      : card.kind === 'complicated'
        ? (complicated?.design ?? null)
        : null;
  return (
    <>
      <CardWords card={card} input={copyInput} />
      {scene && (
        <div className="absolute inset-0" style={hidden ? { visibility: 'hidden' } : undefined}>
          <div aria-hidden="true">
            <SceneCanvas scene={scene} elapsed={elapsed} reduced={reduced} />
            {scene.model && modelSource && (
              <ModelView
                slot={scene.model}
                mesh={meshes.get(modelSource.id)}
                thumbnail={modelSource.thumbnail}
                name={modelSource.name}
                elapsed={elapsed}
                reduced={reduced}
              />
            )}
            {scene.texts.map((block) => (
              <TextView key={block.key} block={block} elapsed={elapsed} reduced={reduced} />
            ))}
          </div>
          {scene.keys && (
            <ThanksKeys
              y={scene.keys.y}
              enter={scene.keys.enter}
              elapsed={elapsed}
              reduced={reduced}
              locale={locale}
              onRollCredits={onRollCredits}
              onSupport={onSupport}
            />
          )}
        </div>
      )}
    </>
  );
}
