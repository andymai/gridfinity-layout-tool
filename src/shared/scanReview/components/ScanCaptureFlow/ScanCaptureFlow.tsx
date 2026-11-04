/**
 * The phone's scan flow: photograph one or more tools, find every one
 * in-browser (the colour segmenter, each outline then redrawn by the
 * tap-prompted model), let the user remove or retap, then hand the outlines on
 * as one SVG through `onUse`. The photo never leaves the device.
 *
 * When a size reference is in frame (the printed calibration sheet, or a
 * wallet card) the outline is rectified to true millimetres; otherwise it is a
 * pixel outline and whoever receives it has to ask for one real dimension.
 *
 * Runs as the `/scan/:token` page, which uploads to the desktop's session, and
 * inside the bin designer on phones, which adds the tools to the open bin.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Spinner, Switch } from '@/design-system';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import {
  decodeImageToCanvas,
  imageDataFromCanvas,
  preloadSegmenter,
  cardPerspectiveSkew,
  withCardSize,
  STEEP_CARD_SKEW,
  type ImageDataLike,
  type Point,
  type SceneTrace,
} from '@/shared/scanTrace';
import {
  bounds,
  cardOptions,
  CardSizeEditor,
  loadCardSize,
  saveCardSize,
  ScanOverlay,
  ScanToolList,
  shownShapes,
  svgFromShapes,
  traceAll,
  traceTap,
  visibleShapes,
  withoutShape,
  type CardSizeMm,
  TraceExportMenu,
  toolsFromShapes,
} from '../..';
import { ProgressSteps, CaptureGuide, CardStatusIcon, SentIcon, TapIcon } from './ScanCaptureGuide';
import type { Step } from './ScanCaptureGuide';

/**
 * What became of the traced outlines: sent on to another device (the flow
 * shows its done screen), taken in by the caller (which closes the flow), or
 * refused with a message to show.
 */
export type ScanUseOutcome =
  | { readonly kind: 'sent' }
  | { readonly kind: 'taken' }
  | { readonly kind: 'error'; readonly messageKey: string };

interface ScanCaptureFlowProps {
  readonly onUse: (svg: string, count: number) => Promise<ScanUseOutcome>;
  /** `page` fills the phone's screen with its own title; `embedded` sits in a dialog that has one. */
  readonly layout: 'page' | 'embedded';
}

interface ReviewState {
  readonly canvas: HTMLCanvasElement;
  readonly image: ImageDataLike;
  readonly scene: SceneTrace;
  /** The scene before the last tap or removal, so a model that grabbed too much can be undone. */
  readonly previous: SceneTrace | null;
  readonly photoUrl: string;
  /** False when the model could not run, so tapping the photo does nothing. */
  readonly canRefine: boolean;
  readonly resegmenting: boolean;
  readonly sending: boolean;
}

type Status =
  | { readonly kind: 'capture' }
  | { readonly kind: 'processing' }
  | ({ readonly kind: 'review' } & ReviewState)
  | { readonly kind: 'sent'; readonly count: number }
  | { readonly kind: 'finished' }
  | { readonly kind: 'error'; readonly messageKey: string };

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** A redraw or an upload is under way, so the outlines must hold still. */
const busy = (review: ReviewState): boolean => review.resegmenting || review.sending;

function measuredFromKey(scene: SceneTrace): string {
  if (scene.reference?.kind === 'strip') return 'scan.stripMeasured';
  if (!scene.grid) return 'scan.cardMeasured';
  return scene.grid.kind === 'sheet' ? 'scan.gridMeasured' : 'scan.baseplateMeasured';
}

export function ScanCaptureFlow({ onUse, layout }: ScanCaptureFlowProps) {
  const t = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const imageBoxRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'capture' });
  const [cardSize, setCardSize] = useState<CardSizeMm>(loadCardSize);
  const [keepHoles, setKeepHoles] = useState(false);

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
      const traced = await traceAll(canvas, image, cardOptions(cardSize));
      if (!isOk(traced)) {
        setStatus({ kind: 'error', messageKey: 'scan.error.noObject' });
        return;
      }
      setStatus({
        kind: 'review',
        canvas,
        image,
        scene: traced.value.scene,
        previous: null,
        photoUrl: URL.createObjectURL(file),
        canRefine: traced.value.canRefine,
        resegmenting: false,
        sending: false,
      });
    },
    [cardSize]
  );

  // Redraw (or add) the tool the user tapped on the photo.
  const handleTap = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const box = imageBoxRef.current;
      setStatus((prev) => {
        if (prev.kind !== 'review' || !box || !prev.canRefine || busy(prev)) return prev;
        const rect = box.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return prev;
        const seed: Point = {
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        };
        const { canvas, image, scene: current } = prev;
        void (async () => {
          const next = await traceTap(canvas, image, current, seed, cardOptions(cardSize));
          // Remove and Undo are locked while this runs, so `current` is still the live scene.
          setStatus((s) =>
            s.kind !== 'review'
              ? s
              : isOk(next)
                ? { ...s, scene: next.value, previous: s.scene, resegmenting: false }
                : { ...s, resegmenting: false }
          );
        })();
        return { ...prev, resegmenting: true };
      });
    },
    [cardSize]
  );

  // `index` counts the tools on screen, judged as the list judges them.
  const handleRemove = useCallback(
    (index: number) => {
      setStatus((prev) => {
        if (prev.kind !== 'review' || busy(prev)) return prev;
        const rectified = withCardSize(prev.scene, cardSize.longMm, cardSize.shortMm);
        const listed = shownShapes(rectified.shapes, keepHoles, rectified.units);
        const at = listed.at(index);
        const gone = at && prev.scene.shapes[at.index];
        if (listed.length < 2 || !gone) return prev;
        return {
          ...prev,
          scene: { ...prev.scene, shapes: withoutShape(prev.scene.shapes, gone) },
          previous: prev.scene,
        };
      });
    },
    [keepHoles, cardSize]
  );

  const handleUndo = useCallback(() => {
    setStatus((prev) =>
      prev.kind === 'review' && prev.previous && !busy(prev)
        ? { ...prev, scene: prev.previous, previous: null }
        : prev
    );
  }, []);

  const handleCardSize = useCallback((next: CardSizeMm) => {
    setCardSize(next);
    saveCardSize(next);
  }, []);

  // Applied at the point of use rather than baked into the traced scene: the
  // card's corners are already solved, so a new card size only re-solves the
  // image→mm map. Editing the size stays instant and can't reshape the outline.
  const scene =
    status.kind === 'review' ? withCardSize(status.scene, cardSize.longMm, cardSize.shortMm) : null;

  // Saved on the phone itself, so only once the outlines are in millimetres.
  const exportTools = useMemo(
    () =>
      scene && scene.units === 'mm'
        ? toolsFromShapes(visibleShapes(scene.shapes, keepHoles, scene.units), keepHoles)
        : null,
    [scene, keepHoles]
  );

  const handleUse = useCallback(async () => {
    if (status.kind !== 'review') return;
    const rectified = withCardSize(status.scene, cardSize.longMm, cardSize.shortMm);
    const sending = visibleShapes(rectified.shapes, keepHoles, rectified.units);
    if (sending.length === 0) return;
    const svg = svgFromShapes(sending, rectified.units, keepHoles);
    const count = sending.length;
    setStatus({ ...status, sending: true });
    const outcome = await onUse(svg, count);
    if (outcome.kind === 'sent') setStatus({ kind: 'sent', count });
    else if (outcome.kind === 'error') setStatus({ kind: 'error', messageKey: outcome.messageKey });
    else setStatus({ kind: 'capture' });
  }, [status, onUse, cardSize, keepHoles]);

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

  const shown = useMemo(
    () => visibleShapes(scene?.shapes ?? [], keepHoles, scene?.units ?? 'px'),
    [scene, keepHoles]
  );
  const toolCount = shown.length;
  const measured = scene && scene.units === 'mm' && shown[0] ? bounds(shown[0].outputPoints) : null;
  const holesFound = scene?.shapes.some((s) => (s.holes?.length ?? 0) > 0 || s.inHole) ?? false;

  const cardSteep =
    scene !== null &&
    scene.card !== null &&
    cardPerspectiveSkew(scene.card.corners) > STEEP_CARD_SKEW;

  return (
    <div
      className={`flex flex-col bg-surface text-content-primary ${
        layout === 'page' ? 'h-[100dvh] min-h-[100dvh]' : 'h-full min-h-0'
      }`}
      style={layout === 'page' ? { paddingTop: 'env(safe-area-inset-top)' } : undefined}
    >
      <header className="shrink-0 px-5 pt-4 pb-3">
        {layout === 'page' && (
          <h1 className="text-center text-lg font-semibold">{t('scan.title')}</h1>
        )}
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
                onPointerDown={status.canRefine ? handleTap : undefined}
                className={`relative w-full overflow-hidden rounded-xl border border-stroke ${
                  status.canRefine ? 'cursor-pointer' : ''
                }`}
              >
                <img
                  src={status.photoUrl}
                  alt={t('scan.photoAlt')}
                  className="block h-auto w-full select-none"
                  draggable={false}
                />
                <ScanOverlay
                  image={status.image}
                  scene={scene}
                  shapes={shown}
                  keepHoles={keepHoles}
                />
                {status.resegmenting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface/40">
                    <Spinner size="sm" />
                  </div>
                )}
              </div>

              {status.previous && (
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  className="self-end"
                  disabled={busy(status)}
                  onClick={handleUndo}
                >
                  {t('scan.review.undo')}
                </Button>
              )}

              <div
                className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                  measured ? 'border-success/40 bg-success/10' : 'border-warning bg-warning-muted'
                }`}
              >
                <CardStatusIcon ok={measured !== null} />
                {measured ? (
                  <div className="flex flex-col gap-0.5 text-left">
                    <p className="text-sm font-semibold text-content-primary">
                      {toolCount > 1
                        ? t('scan.review.toolsFound', { count: toolCount })
                        : t('binDesigner.cutouts.scanImport.resultSize', {
                            width: round1(measured.w),
                            depth: round1(measured.h),
                          })}
                    </p>
                    <p className="text-xs text-success">{t(measuredFromKey(scene))}</p>
                    {/* With one tool there is no list to carry the note. */}
                    {toolCount === 1 && shown[0].underStrip && (
                      <p className="text-xs text-warning">{t('scan.review.underStrip')}</p>
                    )}
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

              {holesFound && (
                <div className="flex w-full flex-col gap-1">
                  <Switch
                    checked={keepHoles}
                    onChange={setKeepHoles}
                    label={t('scan.review.keepHoles')}
                    disabled={busy(status)}
                  />
                  <p className="text-xs text-content-tertiary">{t('scan.review.keepHolesHint')}</p>
                </div>
              )}

              {toolCount > 1 && (
                <ScanToolList
                  shapes={shown}
                  units={scene.units}
                  disabled={busy(status)}
                  onRemove={handleRemove}
                />
              )}

              {status.canRefine ? (
                <div className="flex w-full items-start gap-2.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2.5 text-left">
                  <TapIcon />
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold text-content-primary">
                      {t(
                        toolCount > 1 ? 'scan.review.confirmTitleMany' : 'scan.review.confirmTitle'
                      )}
                    </p>
                    <p className="text-xs text-content-secondary">
                      {t(toolCount > 1 ? 'scan.review.tapHintMany' : 'scan.review.tapHint')}
                    </p>
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
              <SentIcon />
              <p className="text-lg font-medium">
                {t(status.count > 1 ? 'scan.sent.titleMany' : 'scan.sent.title')}
              </p>
              <p className="max-w-xs text-sm text-content-secondary">
                {t(status.count > 1 ? 'scan.sent.bodyMany' : 'scan.sent.body')}
              </p>
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
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => fileInputRef.current?.click()}
              >
                {t('scan.takePhoto')}
              </Button>
              {/* Second input without `capture`, so the OS offers the gallery /
                  file picker instead of forcing the live camera — lets the user
                  trace an existing photo. */}
              <Button
                type="button"
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() => uploadInputRef.current?.click()}
              >
                {t('scan.uploadPhoto')}
              </Button>
            </div>
          )}

          {status.kind === 'review' && (
            <TraceExportMenu
              tools={exportTools}
              source="phone"
              trigger="download"
              placement="top-start"
              fullWidth
              disabled={status.sending || status.resegmenting}
            />
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
                disabled={status.sending || status.resegmenting || toolCount === 0}
                onClick={() => void handleUse()}
              >
                {status.sending
                  ? t('scan.sending')
                  : toolCount > 1
                    ? t('scan.useMany', { count: toolCount })
                    : t('scan.use')}
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
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
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
