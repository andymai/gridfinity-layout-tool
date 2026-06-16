/**
 * Mobile capture page (`/scan/:token`).
 *
 * Standalone, lightweight route: the phone photographs a tool, traces its
 * silhouette in-browser (no 3D bundle), lets the user confirm/adjust, then
 * uploads the outline SVG to the scan session the desktop is polling. The photo
 * never leaves the device — only the traced outline is sent.
 *
 * When a reference card is in frame, the outline is rectified to true
 * millimetres (perspective + scale solved); otherwise it falls back to a pixel
 * outline and the desktop asks for one real dimension.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, SliderInput } from '@/design-system';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import {
  decodeImageToImageData,
  traceScene,
  pointsToSvgPath,
  type ImageDataLike,
  type Point,
  type SceneTrace,
} from '@/shared/scanTrace';

interface ScanPageProps {
  readonly token: string;
}

interface ReviewState {
  readonly image: ImageDataLike;
  readonly scene: SceneTrace;
  readonly photoUrl: string;
  readonly threshold: number | null;
  readonly sending: boolean;
}

type Status =
  | { readonly kind: 'capture' }
  | { readonly kind: 'processing' }
  | ({ readonly kind: 'review' } & ReviewState)
  | { readonly kind: 'sent' }
  | { readonly kind: 'error'; readonly messageKey: string };

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

export function ScanPage({ token }: ScanPageProps) {
  const t = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const traceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'capture' });

  useEffect(
    () => () => {
      if (traceTimer.current) clearTimeout(traceTimer.current);
    },
    []
  );

  // Revoke the object URL when it changes or the page unmounts.
  const photoUrl = status.kind === 'review' ? status.photoUrl : null;
  useEffect(() => {
    if (!photoUrl) return;
    return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const handleFile = useCallback(async (file: File) => {
    setStatus({ kind: 'processing' });
    let image: ImageDataLike;
    try {
      image = await decodeImageToImageData(file);
    } catch {
      setStatus({ kind: 'error', messageKey: 'scan.error.decode' });
      return;
    }
    const traced = traceScene(image);
    if (!isOk(traced)) {
      setStatus({ kind: 'error', messageKey: 'scan.error.noObject' });
      return;
    }
    setStatus({
      kind: 'review',
      image,
      scene: traced.value,
      photoUrl: URL.createObjectURL(file),
      threshold: null,
      sending: false,
    });
  }, []);

  const handleThreshold = useCallback((value: number) => {
    // Keep the slider responsive; defer the heavier re-trace until the drag settles.
    setStatus((prev) => (prev.kind === 'review' ? { ...prev, threshold: value } : prev));
    if (traceTimer.current) clearTimeout(traceTimer.current);
    traceTimer.current = setTimeout(() => {
      setStatus((prev) => {
        if (prev.kind !== 'review') return prev;
        const traced = traceScene(prev.image, { threshold: value });
        return isOk(traced) ? { ...prev, scene: traced.value } : prev;
      });
    }, 140);
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

  const measured =
    status.kind === 'review' && status.scene.units === 'mm'
      ? bounds(status.scene.outputPoints)
      : null;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center gap-5 bg-surface px-4 py-8 text-center">
      <h1 className="text-xl font-semibold text-content-primary">{t('scan.title')}</h1>

      {status.kind === 'capture' && (
        <>
          <p className="max-w-sm text-sm text-content-secondary">{t('scan.instructions')}</p>
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => fileInputRef.current?.click()}
          >
            {t('scan.takePhoto')}
          </Button>
        </>
      )}

      {status.kind === 'processing' && (
        <p className="py-12 text-sm text-content-secondary">{t('scan.processing')}</p>
      )}

      {status.kind === 'review' && (
        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          <p className="text-sm text-content-secondary">{t('scan.review.title')}</p>
          <div className="relative inline-block overflow-hidden rounded-lg border border-stroke">
            <img src={status.photoUrl} alt={t('scan.photoAlt')} className="block h-auto w-full" />
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
                className="stroke-accent"
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          {measured ? (
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-sm font-medium text-content-primary">
                {t('binDesigner.cutouts.scanImport.resultSize', {
                  width: round1(measured.w),
                  depth: round1(measured.h),
                })}
              </p>
              <p className="text-xs text-success">{t('scan.cardMeasured')}</p>
            </div>
          ) : (
            <p className="text-xs text-content-tertiary">{t('scan.noCardHint')}</p>
          )}

          <SliderInput
            label={t('scan.threshold')}
            value={status.threshold ?? 128}
            onChange={handleThreshold}
            min={1}
            max={254}
            step={1}
          />

          <div className="flex w-full gap-3">
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
              disabled={status.sending}
              onClick={() => void handleUse()}
            >
              {status.sending ? t('scan.sending') : t('scan.use')}
            </Button>
          </div>
        </div>
      )}

      {status.kind === 'sent' && (
        <div className="flex flex-col items-center gap-2 py-12">
          <p className="text-lg font-medium text-content-primary">{t('scan.sent.title')}</p>
          <p className="max-w-sm text-sm text-content-secondary">{t('scan.sent.body')}</p>
        </div>
      )}

      {status.kind === 'error' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="max-w-sm text-sm text-content-secondary">{t(status.messageKey)}</p>
          <Button type="button" variant="primary" onClick={reset}>
            {t('scan.retake')}
          </Button>
        </div>
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
