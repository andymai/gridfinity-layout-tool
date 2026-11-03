import { useRef, useState } from 'react';
import { IconButton, Spinner } from '@/design-system';
import { useTranslation } from '@/i18n';
import { ScanOverlay } from '@/shared/scanReview';
import type { Point, SceneShape, SceneTrace } from '@/shared/scanTrace';
import { toImage, useViewport } from './viewport';
import type { TracePhoto } from './useTraceSession';
import { MARKS_NEEDED, type TraceMode } from './traceMode';
import { TraceLoupe } from './TraceLoupe';

interface TraceCanvasProps {
  readonly photo: TracePhoto;
  readonly scene: SceneTrace;
  readonly shapes: readonly SceneShape[];
  readonly keepHoles: boolean;
  readonly mode: TraceMode;
  readonly region: readonly Point[] | null;
  /** Ruler ends or paper corners being placed, in image pixels. */
  readonly marks: readonly Point[];
  readonly busy: boolean;
  readonly canRefine: boolean;
  /** A click on a tool, as a fraction of the photo's width and height. */
  readonly onTap: (seed: Point) => void;
  readonly onRegion: (region: readonly Point[]) => void;
  readonly onMarks: (marks: readonly Point[]) => void;
}

/** Screen pixels a press may travel and still count as a click. */
const CLICK_SLOP = 4;
/** Screen pixels from a mark that grab it. */
const GRAB_RADIUS = 12;
/** Tool number badges keep this radius on screen at any zoom. */
const BADGE_PX = 11;
/** A region narrower than this, in image pixels, is a slip. */
const MIN_REGION_PX = 6;

type Gesture =
  | { readonly kind: 'press'; readonly at: Point; readonly last: Point; readonly moved: boolean }
  | { readonly kind: 'pan'; readonly last: Point }
  | { readonly kind: 'mark'; readonly index: number }
  | { readonly kind: 'region'; readonly from: Point; readonly to: Point };

const rect = (a: Point, b: Point): Point[] => [
  { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
  { x: Math.max(a.x, b.x), y: Math.min(a.y, b.y) },
  { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
  { x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) },
];

const ring = (points: readonly Point[]): string =>
  `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`;

export function TraceCanvas({
  photo,
  scene,
  shapes,
  keepHoles,
  mode,
  region,
  marks,
  busy,
  canRefine,
  onTap,
  onRegion,
  onMarks,
}: TraceCanvasProps) {
  const t = useTranslation();
  const box = useRef<HTMLDivElement | null>(null);
  const { width, height } = photo.image;
  const { view, box: measured, zoomBy, panBy, fit } = useViewport(photo.image, box);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  // Where the pointer is while marking, in screen pixels, for the loupe.
  const [hover, setHover] = useState<Point | null>(null);

  const local = (e: React.PointerEvent): Point => {
    const r = box.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const clamp = (p: Point): Point => ({
    x: Math.min(width, Math.max(0, p.x)),
    y: Math.min(height, Math.max(0, p.y)),
  });
  const marking = mode === 'ruler' || mode === 'paper';

  const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) return;
    // jsdom has no pointer capture.
    if ('setPointerCapture' in e.currentTarget) e.currentTarget.setPointerCapture(e.pointerId);
    const at = local(e);
    if (e.button === 1) {
      setGesture({ kind: 'pan', last: at });
      return;
    }
    if (marking) {
      const grabbed = marks.findIndex((m) => {
        const s = { x: m.x * view.scale + view.x, y: m.y * view.scale + view.y };
        return Math.hypot(s.x - at.x, s.y - at.y) <= GRAB_RADIUS;
      });
      if (grabbed !== -1) {
        setGesture({ kind: 'mark', index: grabbed });
        return;
      }
    }
    if (mode === 'region') {
      const from = clamp(toImage(view, at));
      setGesture({ kind: 'region', from, to: from });
      return;
    }
    if (marking) setHover(at);
    setGesture({ kind: 'press', at, last: at, moved: false });
  };

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const at = local(e);
    if (marking) setHover(at);
    if (!gesture) return;
    if (gesture.kind === 'pan' || (gesture.kind === 'press' && gesture.moved)) {
      panBy(at.x - gesture.last.x, at.y - gesture.last.y);
      setGesture({ ...gesture, last: at });
    } else if (gesture.kind === 'press') {
      if (Math.hypot(at.x - gesture.at.x, at.y - gesture.at.y) > CLICK_SLOP) {
        panBy(at.x - gesture.last.x, at.y - gesture.last.y);
        setGesture({ ...gesture, last: at, moved: true });
      }
    } else if (gesture.kind === 'mark') {
      const next = [...marks];
      next[gesture.index] = clamp(toImage(view, at));
      onMarks(next);
    } else {
      setGesture({ ...gesture, to: clamp(toImage(view, at)) });
    }
  };

  const handleUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const done = gesture;
    setGesture(null);
    if (!done) return;
    if (done.kind === 'region') {
      const [a, , c] = rect(done.from, done.to);
      if (c.x - a.x >= MIN_REGION_PX && c.y - a.y >= MIN_REGION_PX) {
        onRegion(rect(done.from, done.to));
      }
      return;
    }
    if (done.kind !== 'press' || done.moved) return;
    const q = toImage(view, local(e));
    const onPhoto = q.x >= 0 && q.y >= 0 && q.x <= width && q.y <= height;
    if (mode === 'tap') {
      if (onPhoto && canRefine && !busy) onTap({ x: q.x / width, y: q.y / height });
    } else if (marking) {
      const needed = MARKS_NEEDED[mode];
      // A full set starts over, so a misplaced ruler is redrawn with two clicks.
      onMarks(marks.length < needed ? [...marks, clamp(q)] : [clamp(q)]);
    }
  };

  const draftRegion = gesture?.kind === 'region' ? rect(gesture.from, gesture.to) : null;
  const shownRegion = draftRegion ?? region;
  const applied = scene.reference;
  const handle = 7 / view.scale;
  const label = 13 / view.scale;
  const ruler =
    mode === 'ruler'
      ? marks
      : marks.length === 0 && applied?.kind === 'ruler'
        ? [applied.ruler.a, applied.ruler.b]
        : [];
  const paper =
    mode === 'paper'
      ? marks
      : marks.length === 0 && applied?.kind === 'paper'
        ? applied.paper.corners
        : [];
  const rulerMm = mode !== 'ruler' && applied?.kind === 'ruler' ? applied.ruler.lengthMm : null;

  // A press that has not moved is a mark about to land, and on a touch screen
  // there was no hover before it; a press that moved is a pan.
  const placing = !gesture || (gesture.kind === 'press' && !gesture.moved);
  const loupeAt = !marking
    ? null
    : gesture?.kind === 'mark'
      ? (marks.at(gesture.index) ?? null)
      : hover && placing
        ? clamp(toImage(view, hover))
        : null;

  const cursor =
    gesture?.kind === 'pan' || (gesture?.kind === 'press' && gesture.moved)
      ? 'cursor-grabbing'
      : mode === 'tap'
        ? canRefine
          ? 'cursor-pointer'
          : 'cursor-grab'
        : 'cursor-crosshair';

  return (
    <div
      ref={box}
      role="application"
      aria-label={t('binDesigner.cutouts.traceView.canvasLabel')}
      className={`relative h-full w-full touch-none select-none overflow-hidden ${cursor}`}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={() => setGesture(null)}
      onPointerLeave={() => setHover(null)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="absolute"
        style={{
          left: view.x,
          top: view.y,
          width: width * view.scale,
          height: height * view.scale,
        }}
      >
        <img
          src={photo.url}
          alt={t('scan.photoAlt')}
          className="block h-full w-full"
          draggable={false}
        />
        <ScanOverlay
          image={photo.image}
          scene={scene}
          shapes={shapes}
          keepHoles={keepHoles}
          badgeRadius={BADGE_PX / view.scale}
        />
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          {shownRegion && (
            <>
              <path
                d={`${ring(rect({ x: 0, y: 0 }, { x: width, y: height }))} ${ring(shownRegion)}`}
                fillRule="evenodd"
                className="fill-black/35"
              />
              <path
                d={ring(shownRegion)}
                className="stroke-accent"
                strokeWidth={2}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
          {paper.length > 1 && (
            <path
              d={
                paper.length === 4
                  ? ring(paper)
                  : `M ${paper.map((p) => `${p.x} ${p.y}`).join(' L ')}`
              }
              className="stroke-success"
              strokeWidth={2}
              strokeDasharray={mode === 'paper' ? '6 4' : undefined}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {ruler.length === 2 && (
            <line
              x1={ruler[0].x}
              y1={ruler[0].y}
              x2={ruler[1].x}
              y2={ruler[1].y}
              className="stroke-success"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {rulerMm !== null && ruler.length === 2 && (
            <text
              x={(ruler[0].x + ruler[1].x) / 2}
              y={(ruler[0].y + ruler[1].y) / 2 - label * 0.6}
              textAnchor="middle"
              fontSize={label}
              className="fill-success font-semibold"
              stroke="black"
              strokeWidth={label * 0.25}
              paintOrder="stroke"
            >
              {t('binDesigner.cutouts.traceView.rulerLength', { length: rulerMm })}
            </text>
          )}
          {(mode === 'ruler' ? ruler : mode === 'paper' ? paper : []).map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={handle}
                className="fill-surface stroke-success"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
              {mode === 'paper' && (
                <text
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={handle * 1.3}
                  className="fill-content-primary font-semibold"
                >
                  {i + 1}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {loupeAt && hover && (
        <TraceLoupe
          url={photo.url}
          image={photo.image}
          at={loupeAt}
          scale={view.scale}
          screen={hover}
          canvas={measured ?? { width: 0, height: 0 }}
        />
      )}

      {busy && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/30">
          <Spinner size="md" />
        </div>
      )}

      <div
        className="absolute bottom-3 left-3 flex gap-1 rounded-lg border border-stroke bg-surface-elevated/90 p-1 shadow-sm"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <IconButton
          aria-label={t('binDesigner.cutouts.traceView.zoomOut')}
          size="sm"
          onClick={() => zoomBy(1 / 1.25)}
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M3.5 8h9" strokeLinecap="round" />
          </svg>
        </IconButton>
        <IconButton
          aria-label={t('binDesigner.cutouts.traceView.zoomIn')}
          size="sm"
          onClick={() => zoomBy(1.25)}
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M3.5 8h9M8 3.5v9" strokeLinecap="round" />
          </svg>
        </IconButton>
        <IconButton aria-label={t('binDesigner.cutouts.traceView.fit')} size="sm" onClick={fit}>
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path
              d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
      </div>
    </div>
  );
}
