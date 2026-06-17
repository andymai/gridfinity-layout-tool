/**
 * Mobile capture page (`/scan/:token`).
 *
 * Standalone, lightweight route: the phone photographs a tool, segments it
 * in-browser (tap-prompted ML, with a classical fallback), lets the user
 * confirm/retap, then uploads the outline SVG to the scan session the desktop
 * is polling. The photo never leaves the device — only the traced outline.
 *
 * When a reference card is in frame, the outline is rectified to true
 * millimetres (perspective + scale solved); otherwise it falls back to a pixel
 * outline and the desktop asks for one real dimension.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Spinner } from '@/design-system';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import {
  decodeImageToCanvas,
  imageDataFromCanvas,
  computeAutoSeed,
  segmentAt,
  traceSceneSegmented,
  traceScene,
  preloadSegmenter,
  pointsToSvgPath,
  cardPerspectiveSkew,
  STEEP_CARD_SKEW,
  type ImageDataLike,
  type SoftMask,
  type Point,
  type SceneTrace,
} from '@/shared/scanTrace';

interface ScanPageProps {
  readonly token: string;
}

interface ReviewState {
  readonly canvas: HTMLCanvasElement;
  readonly image: ImageDataLike;
  readonly toolMask: SoftMask | null;
  readonly scene: SceneTrace;
  readonly photoUrl: string;
  readonly seed: Point;
  readonly resegmenting: boolean;
  readonly sending: boolean;
}

type Status =
  | { readonly kind: 'capture' }
  | { readonly kind: 'processing' }
  | ({ readonly kind: 'review' } & ReviewState)
  | { readonly kind: 'sent' }
  | { readonly kind: 'error'; readonly messageKey: string };

type Step = 'capture' | 'review' | 'done';

const round1 = (n: number): number => Math.round(n * 10) / 10;

function bounds(points: readonly Point[]): { minX: number; minY: number; w: number; h: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

/** Normalize to a 0-origin viewBox so the outline imports at its true size. */
function svgFromPoints(points: readonly Point[], units: 'mm' | 'px'): string {
  const { minX, minY, w, h } = bounds(points);
  const shifted = points.map((p) => ({ x: p.x - minX, y: p.y - minY }));
  // Tag mm output so the desktop can skip its scale-confirm step.
  const unitsAttr = units === 'mm' ? ' data-scan-units="mm"' : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round1(w)} ${round1(h)}"${unitsAttr}>` +
    `<path d="${pointsToSvgPath(shifted)}"/></svg>`
  );
}

/** Trace the object at `seed`: ML segmenter first, classical Otsu as fallback. */
async function traceAt(
  canvas: HTMLCanvasElement,
  image: ImageDataLike,
  seed: Point
): Promise<{ scene: SceneTrace; toolMask: SoftMask | null } | null> {
  try {
    const toolMask = await segmentAt(canvas, seed);
    const traced = traceSceneSegmented(image, toolMask);
    if (isOk(traced)) return { scene: traced.value, toolMask };
  } catch {
    // Model failed to load/run — fall through to the classical tracer.
  }
  const classical = traceScene(image);
  return isOk(classical) ? { scene: classical.value, toolMask: null } : null;
}

export function ScanPage({ token }: ScanPageProps) {
  const t = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageBoxRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'capture' });

  // Warm the model while the user reads the guidance and frames the shot, so
  // the first segmentation isn't gated on the download.
  useEffect(() => {
    preloadSegmenter();
  }, []);

  // Revoke the object URL when it changes or the page unmounts.
  const photoUrl = status.kind === 'review' ? status.photoUrl : null;
  useEffect(() => {
    if (!photoUrl) return;
    return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const handleFile = useCallback(async (file: File) => {
    setStatus({ kind: 'processing' });
    let canvas: HTMLCanvasElement;
    try {
      canvas = await decodeImageToCanvas(file);
    } catch {
      setStatus({ kind: 'error', messageKey: 'scan.error.decode' });
      return;
    }
    const image = imageDataFromCanvas(canvas);
    const seed = computeAutoSeed(image);
    const traced = await traceAt(canvas, image, seed);
    if (!traced) {
      setStatus({ kind: 'error', messageKey: 'scan.error.noObject' });
      return;
    }
    setStatus({
      kind: 'review',
      canvas,
      image,
      toolMask: traced.toolMask,
      scene: traced.scene,
      photoUrl: URL.createObjectURL(file),
      seed,
      resegmenting: false,
      sending: false,
    });
  }, []);

  // Re-segment around the point the user tapped on the photo.
  const handleTap = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const box = imageBoxRef.current;
    setStatus((prev) => {
      if (prev.kind !== 'review' || !box || prev.toolMask === null || prev.resegmenting)
        return prev;
      const rect = box.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return prev;
      const seed: Point = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
      const { canvas, image } = prev;
      void (async () => {
        try {
          const toolMask = await segmentAt(canvas, seed);
          const traced = traceSceneSegmented(image, toolMask);
          if (isOk(traced)) {
            setStatus((s) =>
              s.kind === 'review'
                ? { ...s, scene: traced.value, toolMask, seed, resegmenting: false }
                : s
            );
            return;
          }
        } catch {
          // Keep the previous outline on failure.
        }
        setStatus((s) => (s.kind === 'review' ? { ...s, resegmenting: false } : s));
      })();
      return { ...prev, seed, resegmenting: true };
    });
  }, []);

  const handleUse = useCallback(async () => {
    if (status.kind !== 'review') return;
    const svg = svgFromPoints(status.scene.outputPoints, status.scene.units);
    setStatus({ ...status, sending: true });
    try {
      const res = await fetch(`/api/scan-session/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ svg }),
      });
      if (res.ok) {
        setStatus({ kind: 'sent' });
      } else if (res.status === 404) {
        setStatus({ kind: 'error', messageKey: 'scan.error.expired' });
      } else {
        setStatus({ kind: 'error', messageKey: 'scan.error.send' });
      }
    } catch {
      setStatus({ kind: 'error', messageKey: 'scan.error.send' });
    }
  }, [status, token]);

  const reset = useCallback(() => setStatus({ kind: 'capture' }), []);

  const step: Step =
    status.kind === 'sent' ? 'done' : status.kind === 'review' ? 'review' : 'capture';

  const measured =
    status.kind === 'review' && status.scene.units === 'mm'
      ? bounds(status.scene.outputPoints)
      : null;

  const cardSteep =
    status.kind === 'review' &&
    status.scene.card !== null &&
    cardPerspectiveSkew(status.scene.card.corners) > STEEP_CARD_SKEW;

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-surface text-content-primary"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="shrink-0 px-5 pt-4 pb-3">
        <h1 className="text-center text-lg font-semibold">{t('scan.title')}</h1>
        <ProgressSteps
          current={step}
          labels={[t('scan.step.capture'), t('scan.step.review'), t('scan.step.done')]}
        />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-4">
        {status.kind === 'capture' && <CaptureGuide t={t} />}

        {status.kind === 'processing' && (
          <div className="flex flex-col items-center gap-3 py-16 text-content-secondary">
            <Spinner size="md" />
            <p className="text-sm">{t('scan.processing')}</p>
          </div>
        )}

        {status.kind === 'review' && (
          <div className="flex w-full max-w-md flex-col items-center gap-3">
            <div
              ref={imageBoxRef}
              onPointerDown={status.toolMask ? handleTap : undefined}
              className={`relative w-full overflow-hidden rounded-xl border border-stroke ${
                status.toolMask ? 'cursor-pointer' : ''
              }`}
            >
              <img
                src={status.photoUrl}
                alt={t('scan.photoAlt')}
                className="block h-auto w-full select-none"
                draggable={false}
              />
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${status.image.width} ${status.image.height}`}
                preserveAspectRatio="none"
                fill="none"
              >
                {status.scene.card && (
                  <polygon
                    points={status.scene.card.corners.map((p) => `${p.x},${p.y}`).join(' ')}
                    className="stroke-success"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <polygon
                  points={status.scene.imagePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  className="fill-accent/15 stroke-accent"
                  strokeWidth={3}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {status.resegmenting && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface/40">
                  <Spinner size="sm" />
                </div>
              )}
            </div>

            <div
              className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                measured ? 'border-success/40 bg-success/10' : 'border-warning bg-warning-muted'
              }`}
            >
              <CardStatusIcon ok={measured !== null} />
              {measured ? (
                <div className="flex flex-col gap-0.5 text-left">
                  <p className="text-sm font-semibold text-content-primary">
                    {t('binDesigner.cutouts.scanImport.resultSize', {
                      width: round1(measured.w),
                      depth: round1(measured.h),
                    })}
                  </p>
                  <p className="text-xs text-success">{t('scan.cardMeasured')}</p>
                  {cardSteep && <p className="text-xs text-warning">{t('scan.cardSteepAngle')}</p>}
                </div>
              ) : (
                <div className="flex flex-col gap-0.5 text-left">
                  <p className="text-sm font-semibold text-warning">{t('scan.noCardTitle')}</p>
                  <p className="text-xs text-content-secondary">{t('scan.noCardHint')}</p>
                </div>
              )}
            </div>

            {status.toolMask ? (
              <div className="flex w-full items-start gap-2.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2.5 text-left">
                <TapIcon />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold text-content-primary">
                    {t('scan.review.confirmTitle')}
                  </p>
                  <p className="text-xs text-content-secondary">{t('scan.review.tapHint')}</p>
                </div>
              </div>
            ) : (
              <p className="text-center text-xs text-content-tertiary">
                {t('scan.review.retakeHint')}
              </p>
            )}
          </div>
        )}

        {status.kind === 'sent' && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <p className="text-lg font-medium">{t('scan.sent.title')}</p>
            <p className="max-w-xs text-sm text-content-secondary">{t('scan.sent.body')}</p>
          </div>
        )}

        {status.kind === 'error' && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="max-w-xs text-sm text-content-secondary">{t(status.messageKey)}</p>
          </div>
        )}
      </main>

      <footer className="shrink-0 border-t border-stroke-subtle bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {status.kind === 'capture' && (
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => fileInputRef.current?.click()}
          >
            {t('scan.takePhoto')}
          </Button>
        )}

        {status.kind === 'review' && (
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              disabled={status.sending}
              onClick={reset}
            >
              {t('scan.retake')}
            </Button>
            <Button
              type="button"
              variant="primary"
              fullWidth
              disabled={status.sending || status.resegmenting}
              onClick={() => void handleUse()}
            >
              {status.sending ? t('scan.sending') : t('scan.use')}
            </Button>
          </div>
        )}

        {status.kind === 'error' && (
          <Button type="button" variant="primary" size="lg" fullWidth onClick={reset}>
            {t('scan.retake')}
          </Button>
        )}
      </footer>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function ProgressSteps({
  current,
  labels,
}: {
  readonly current: Step;
  readonly labels: readonly [string, string, string] | string[];
}) {
  const order: Step[] = ['capture', 'review', 'done'];
  const activeIndex = order.indexOf(current);
  return (
    <ol
      className="mx-auto mt-3 flex max-w-xs items-center justify-center gap-2"
      aria-label={labels.join(' · ')}
    >
      {order.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                active
                  ? 'bg-accent text-on-accent'
                  : done
                    ? 'bg-success/20 text-success'
                    : 'bg-surface-elevated text-content-tertiary'
              }`}
            >
              {done ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span
              className={`text-xs ${active ? 'text-content-primary' : 'text-content-tertiary'}`}
            >
              {labels[i]}
            </span>
            {i < order.length - 1 && <span className="h-px w-4 bg-stroke-subtle" />}
          </li>
        );
      })}
    </ol>
  );
}

function CaptureGuide({ t }: { readonly t: ReturnType<typeof useTranslation> }) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-5">
      <ToolCardIllustration />
      <h2 className="text-center text-base font-medium">{t('scan.capture.heading')}</h2>
      <ul className="flex w-full flex-col gap-3">
        <GuideTip text={t('scan.capture.tip.surface')} />
        <GuideTip text={t('scan.capture.tip.card')} />
        <GuideTip text={t('scan.capture.tip.topDown')} />
      </ul>
    </div>
  );
}

/** Success check or warning triangle, matching the card-status banner intent. */
function CardStatusIcon({ ok }: { readonly ok: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`mt-0.5 shrink-0 ${ok ? 'text-success' : 'text-warning'}`}
    >
      {ok ? (
        <path d="M20 6L9 17l-5-5" />
      ) : (
        <>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </>
      )}
    </svg>
  );
}

/** Pointing-hand cue that the photo is tappable to re-select the tool. */
function TapIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-accent"
    >
      <path d="M8 13V5a2 2 0 0 1 4 0v6" />
      <path d="M12 11V4a2 2 0 0 1 4 0v7" />
      <path d="M16 11V6a2 2 0 0 1 4 0v8a8 8 0 0 1-8 8 8 8 0 0 1-7-4l-2.5-4a2 2 0 0 1 3.4-2.1L8 13" />
    </svg>
  );
}

function GuideTip({ text }: { readonly text: string }) {
  return (
    <li className="flex items-start gap-3 text-sm text-content-secondary">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
      <span>{text}</span>
    </li>
  );
}

/** Stylised top-down view: a tool and a reference card on a plain surface. */
function ToolCardIllustration() {
  return (
    <svg
      width="180"
      height="120"
      viewBox="0 0 180 120"
      fill="none"
      aria-hidden="true"
      className="text-content-tertiary"
    >
      <rect
        x="1"
        y="1"
        width="178"
        height="118"
        rx="10"
        className="fill-surface-elevated stroke-stroke-subtle"
        strokeWidth="2"
      />
      {/* Tool */}
      <rect
        x="30"
        y="34"
        width="34"
        height="58"
        rx="9"
        className="fill-accent/15 stroke-accent"
        strokeWidth="2.5"
      />
      <circle cx="47" cy="50" r="7" className="fill-accent/40 stroke-accent" strokeWidth="2" />
      {/* Reference card */}
      <rect
        x="96"
        y="40"
        width="58"
        height="38"
        rx="4"
        className="fill-success/10 stroke-success"
        strokeWidth="2.5"
        strokeDasharray="5 4"
      />
      <rect x="102" y="58" width="14" height="10" rx="2" className="fill-success/40" />
    </svg>
  );
}
