/**
 * Mobile capture page (`/scan/:token`).
 *
 * Standalone, lightweight route: the phone photographs a tool, segments it
 * in-browser (tap-prompted ML, with a classical fallback), lets the user
 * confirm/retap, then uploads the outline SVG to the scan session the desktop
 * is polling. The photo never leaves the device — only the traced outline.
 *
 * When a size reference is in frame — the printed calibration sheet, or a
 * wallet card — the outline is rectified to true millimetres (perspective +
 * scale solved); otherwise it falls back to a pixel outline and the desktop
 * asks for one real dimension.
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
  withCardSize,
  STEEP_CARD_SKEW,
  type ImageDataLike,
  type SoftMask,
  type Point,
  type SceneTrace,
} from '@/shared/scanTrace';
import { loadCardSize, saveCardSize, type CardSizeMm } from '@/features/scan-capture/cardSize';
import { CardSizeEditor } from '@/features/scan-capture/components/CardSizeEditor';
import { ProgressSteps, CaptureGuide, CardStatusIcon, TapIcon } from './ScanPageGuide';
import type { Step } from './ScanPageGuide';

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
  | { readonly kind: 'finished' }
  | { readonly kind: 'error'; readonly messageKey: string };

const round1 = (n: number): number => Math.round(n * 10) / 10;

function measuredFromKey(grid: SceneTrace['grid']): string {
  if (!grid) return 'scan.cardMeasured';
  return grid.kind === 'sheet' ? 'scan.gridMeasured' : 'scan.baseplateMeasured';
}

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

/**
 * Card size as the tracer's detect options. It steers the aspect ratio the
 * detector looks for as well as the metric map, so a non-standard card is
 * recognised as readily as an ID-1 one.
 */
function cardOptions(size: CardSizeMm): { widthMm: number; heightMm: number } {
  return { widthMm: size.longMm, heightMm: size.shortMm };
}

/** Trace the object at `seed`: ML segmenter first, classical Otsu as fallback. */
async function traceAt(
  canvas: HTMLCanvasElement,
  image: ImageDataLike,
  seed: Point,
  cardSize: CardSizeMm
): Promise<{ scene: SceneTrace; toolMask: SoftMask | null } | null> {
  const options = cardOptions(cardSize);
  try {
    const toolMask = await segmentAt(canvas, seed);
    const traced = traceSceneSegmented(image, toolMask, options);
    if (isOk(traced)) return { scene: traced.value, toolMask };
  } catch {
    // Model failed to load/run — fall through to the classical tracer.
  }
  const classical = traceScene(image, options);
  return isOk(classical) ? { scene: classical.value, toolMask: null } : null;
}

export function ScanPage({ token }: ScanPageProps) {
  const t = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageBoxRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'capture' });
  const [cardSize, setCardSize] = useState<CardSizeMm>(loadCardSize);

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

  const handleFile = useCallback(
    async (file: File) => {
      setStatus({ kind: 'processing' });
      let canvas: HTMLCanvasElement;
      try {
        canvas = await decodeImageToCanvas(file);
      } catch {
        setStatus({ kind: 'error', messageKey: 'scan.error.decode' });
        return;
      }
      const image = imageDataFromCanvas(canvas);
      // Same card options as the trace: the seed picks the largest blob that
      // isn't the card, so a card it fails to detect becomes a candidate tool.
      const seed = computeAutoSeed(image, cardOptions(cardSize));
      const traced = await traceAt(canvas, image, seed, cardSize);
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
    },
    [cardSize]
  );

  // Re-segment around the point the user tapped on the photo.
  const handleTap = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
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
            const traced = traceSceneSegmented(image, toolMask, cardOptions(cardSize));
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
    },
    [cardSize]
  );

  const handleCardSize = useCallback((next: CardSizeMm) => {
    setCardSize(next);
    saveCardSize(next);
  }, []);

  // Applied at the point of use rather than baked into the traced scene: the
  // card's corners are already solved, so a new card size only re-solves the
  // image→mm map. Editing the size stays instant and can't reshape the outline.
  const scene =
    status.kind === 'review' ? withCardSize(status.scene, cardSize.longMm, cardSize.shortMm) : null;

  const handleUse = useCallback(async () => {
    if (status.kind !== 'review') return;
    const rectified = withCardSize(status.scene, cardSize.longMm, cardSize.shortMm);
    const svg = svgFromPoints(rectified.outputPoints, rectified.units);
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
  }, [status, token, cardSize]);

  const reset = useCallback(() => setStatus({ kind: 'capture' }), []);
  // window.close() only works on script-opened tabs, so fall through to a
  // terminal "you can close this tab" screen when the browser ignores it.
  const finish = useCallback(() => {
    window.close();
    setStatus({ kind: 'finished' });
  }, []);

  const step: Step =
    status.kind === 'sent' || status.kind === 'finished'
      ? 'done'
      : status.kind === 'review'
        ? 'review'
        : 'capture';

  const measured = scene && scene.units === 'mm' ? bounds(scene.outputPoints) : null;

  const cardSteep =
    scene !== null &&
    scene.card !== null &&
    cardPerspectiveSkew(scene.card.corners) > STEEP_CARD_SKEW;

  return (
    <div
      className="flex h-[100dvh] min-h-[100dvh] flex-col bg-surface text-content-primary"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="shrink-0 px-5 pt-4 pb-3">
        <h1 className="text-center text-lg font-semibold">{t('scan.title')}</h1>
        <ProgressSteps
          current={step}
          labels={[t('scan.step.capture'), t('scan.step.review'), t('scan.step.done')]}
        />
      </header>

      <main className="flex flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="m-auto flex w-full flex-col items-center px-5 py-4">
          {status.kind === 'capture' && <CaptureGuide t={t} />}

          {status.kind === 'processing' && (
            <div className="flex flex-col items-center gap-3 py-16 text-content-secondary">
              <Spinner size="md" />
              <p className="text-sm">{t('scan.processing')}</p>
            </div>
          )}

          {status.kind === 'review' && scene && (
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
                  {scene.card && (
                    <polygon
                      points={scene.card.corners.map((p) => `${p.x},${p.y}`).join(' ')}
                      className="stroke-success"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {scene.grid?.cells.map((cell, i) => (
                    <polygon
                      key={i}
                      points={cell.map((p) => `${p.x},${p.y}`).join(' ')}
                      className="stroke-success"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  <polygon
                    points={scene.imagePoints.map((p) => `${p.x},${p.y}`).join(' ')}
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
                    <p className="text-xs text-success">{t(measuredFromKey(scene.grid))}</p>
                    {/* A lattice fit is over-constrained, so it can report how
                        well it agrees with itself — the card's never can. */}
                    {scene.grid && (
                      <p className="text-xs text-content-secondary">
                        {t(
                          scene.grid.kind === 'sheet' ? 'scan.gridDetail' : 'scan.baseplateDetail',
                          { count: scene.grid.cells.length, rms: round1(scene.grid.rmsMm) }
                        )}
                      </p>
                    )}
                    {/* Worth saying once, at the moment it applies: the plate
                        was made by a printer whose calibration is the unknown
                        this whole feature exists to work around. */}
                    {scene.grid?.kind === 'baseplate' && (
                      <p className="text-xs text-content-tertiary">
                        {t('scan.baseplateAccuracyHint')}
                      </p>
                    )}
                    {cardSteep && (
                      <p className="text-xs text-warning">{t('scan.cardSteepAngle')}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5 text-left">
                    <p className="text-sm font-semibold text-warning">{t('scan.noCardTitle')}</p>
                    <p className="text-xs text-content-secondary">{t('scan.noCardHint')}</p>
                  </div>
                )}
              </div>

              {scene.card && <CardSizeEditor size={cardSize} onChange={handleCardSize} />}

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

          {status.kind === 'finished' && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-lg font-medium">{t('scan.finished.title')}</p>
              <p className="max-w-xs text-sm text-content-secondary">{t('scan.finished.body')}</p>
            </div>
          )}

          {status.kind === 'error' && (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="max-w-xs text-sm text-content-secondary">{t(status.messageKey)}</p>
            </div>
          )}
        </div>
      </main>

      {status.kind !== 'processing' && status.kind !== 'finished' && (
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

          {status.kind === 'sent' && (
            <div className="flex gap-3">
              <Button type="button" variant="secondary" fullWidth onClick={reset}>
                {t('scan.sent.another')}
              </Button>
              <Button type="button" variant="primary" fullWidth onClick={finish}>
                {t('scan.sent.done')}
              </Button>
            </div>
          )}

          {status.kind === 'error' && (
            <Button type="button" variant="primary" size="lg" fullWidth onClick={reset}>
              {t('scan.retake')}
            </Button>
          )}
        </footer>
      )}

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
