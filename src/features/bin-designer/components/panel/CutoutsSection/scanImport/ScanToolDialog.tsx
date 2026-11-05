/**
 * "Scan a tool" dialog.
 *
 * Opens on a choice of route: the phone (a QR code to the capture page, whose
 * uploads arrive here) or a photo on this computer (Trace a photo). A manual
 * SVG upload is always offered as a fallback. An outline without real-world
 * scale goes through a scale-confirm step before it becomes a cutout.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Dialog, Button, Spinner } from '@/design-system';
import { ArrowLeftIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { useToastStore } from '@/core/store/toast';
import { trackEvent } from '@/shared/analytics/posthog';
import { deliverExport } from '@/shared/exportDestination/deliverExport';
import { primeExportFolder } from '@/shared/exportDestination/exportFolder';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';
import { isOk } from '@/core/result';
import type { ScanSource } from '@/features/bin-designer/types';
import { MAX_SVG_FILE_SIZE, type ParsedCutoutSpec } from '../svgImport/types';
import {
  isScaledScan,
  parseScanSvg,
  rescaleToLongestMm,
  scaleTargetMm,
  type ParsedScan,
} from './scanIngest';
import { ScanScaleField } from './ScanScaleField';
import { useScanImport } from './useScanImport';
import { useScanSession, type ScanSessionState } from './useScanSession';
import { ScanQrCode } from './ScanQrCode';
import { ScanRouteChoice } from './ScanRouteChoice';
import { buildCalibrationSheetSvg, CALIBRATION_SHEET_FILENAME } from './calibrationSheetSvg';
import { buildMeasuringStripsSvg, MEASURING_STRIPS_FILENAME } from './measuringStripsSvg';

interface ScanToolDialogProps {
  /**
   * Replaces the default commit into the bin's cutout list. Returns how many
   * specs were consumed (drives the success toast). The Workshop uses this
   * to turn a scan into a cutter profile instead of a bin cutout.
   */
  readonly onImport?: (specs: readonly ParsedCutoutSpec[]) => number;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly source: ScanSource;
  /** A photo dropped or pasted on the editor: opens straight into Trace a photo with it. */
  readonly photo?: File | null;
  /** Called once Trace a photo closes, so the caller can let the photo go. */
  readonly onPhotoDone?: () => void;
}

// The tracer and its model load only once someone traces a photo here.
const TraceView = lazyWithRetry(() =>
  import('../../../TraceView/TraceView').then((m) => ({ default: m.TraceView }))
);

type Stage =
  | { readonly kind: 'awaiting' }
  | {
      readonly kind: 'review';
      readonly svg: string;
      readonly parsed: ParsedScan;
      readonly targetText: string;
    };

export function ScanToolDialog({
  open,
  onClose,
  onImport,
  source,
  photo,
  onPhotoDone,
}: ScanToolDialogProps) {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const { addScanCutouts: addToCutouts } = useScanImport();
  const addScanCutouts = onImport ?? addToCutouts;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'awaiting' });
  const [added, setAdded] = useState(0);
  const [tracing, setTracing] = useState(false);
  const [route, setRoute] = useState<'choose' | 'phone'>('choose');
  // Latched once the phone route is picked, so going Back to the choice keeps
  // the session polling: a phone already on the capture page can still deliver.
  const [phoneStarted, setPhoneStarted] = useState(false);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  // Each route swap unmounts the focused control, so focus is handed on
  // explicitly or it falls out of the dialog's focus trap.
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const phoneCardRef = useRef<HTMLElement | null>(null);
  const focusOnRoute = useRef(false);
  useEffect(() => {
    if (!focusOnRoute.current) return;
    focusOnRoute.current = false;
    (route === 'phone' ? backButtonRef : phoneCardRef).current?.focus();
  }, [route]);

  // Counted on the closed-to-open edge only, with the source it opened from.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) trackEvent('scan_opened', { source });
    wasOpen.current = open;
  }, [open, source]);

  // A scan can arrive mid scale-confirm; read the live stage from a ref (the
  // poll fires outside render) and hold the latecomer until we're back to
  // awaiting, rather than clobbering the in-progress confirmation.
  const stageRef = useRef(stage);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);
  const pendingScanRef = useRef<string | null>(null);

  const handleClose = useCallback(() => {
    setStage({ kind: 'awaiting' });
    setAdded(0);
    setTracing(false);
    setRoute('choose');
    setPhoneStarted(false);
    pendingScanRef.current = null;
    onClose();
  }, [onClose]);

  const ingestSvg = useCallback(
    (svg: string, source: 'phone' | 'desktop' = 'phone') => {
      const result = parseScanSvg(svg);
      if (!isOk(result)) {
        addToast(t('toast.scanImport.parseFailed'), 'error');
        trackEvent('scan_import', { success: false, error_code: result.error.code });
        return;
      }
      // The phone already rectified to true mm (a card was in frame), so the
      // specs are to scale — add them directly and skip the scale-confirm step.
      if (isScaledScan(svg)) {
        const count = addScanCutouts(result.value.specs);
        trackEvent('scan_import', {
          success: true,
          shape_count: count,
          source: source === 'desktop' ? 'desktop_trace' : 'phone_mm',
        });
        addToast(t('toast.scanImport.success', { count }), 'success');
        setAdded((n) => n + count);
        return;
      }
      // A pixel-scale outline needs the scale-confirm step; if one is already in
      // progress, hold this one rather than overwriting the user's entry.
      if (stageRef.current.kind === 'review') {
        pendingScanRef.current = svg;
        return;
      }
      // Start the field empty rather than pre-filling the traced pixel extent:
      // those pixels aren't millimetres, and accepting the prefill produced a
      // wildly oversized cutout. Forcing a measurement keeps the import to scale.
      setStage({
        kind: 'review',
        svg,
        parsed: result.value,
        targetText: '',
      });
    },
    [addToast, t, addScanCutouts]
  );

  // Drain a scan that arrived during scale-confirm once we're back to awaiting.
  useEffect(() => {
    if (stage.kind !== 'awaiting') return;
    const next = pendingScanRef.current;
    if (!next) return;
    pendingScanRef.current = null;
    ingestSvg(next);
  }, [stage.kind, ingestSvg]);

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > MAX_SVG_FILE_SIZE) {
        addToast(t('toast.scanImport.fileTooLarge'), 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') ingestSvg(reader.result);
      };
      reader.onerror = () => addToast(t('toast.scanImport.parseFailed'), 'error');
      reader.readAsText(file);
    },
    [addToast, t, ingestSvg]
  );

  // The sheet is printed on the computer, not the phone, so the offer belongs
  // here rather than on the capture page.
  const handleDownloadSheet = useCallback(() => {
    primeExportFolder();
    const svg = buildCalibrationSheetSvg({
      title: t('binDesigner.cutouts.scanImport.sheetTitle'),
      printHint: t('binDesigner.cutouts.scanImport.sheetPrintHint'),
      placeHint: t('binDesigner.cutouts.scanImport.sheetPlaceHint'),
    });
    void deliverExport(new Blob([svg], { type: 'image/svg+xml' }), CALIBRATION_SHEET_FILENAME);
    trackEvent('scan_calibration_sheet_download');
  }, [t]);

  const handleDownloadStrips = useCallback(() => {
    primeExportFolder();
    const svg = buildMeasuringStripsSvg({
      title: t('binDesigner.cutouts.scanImport.stripsTitle'),
      printHint: t('binDesigner.cutouts.scanImport.stripsPrintHint'),
      placeHint: t('binDesigner.cutouts.scanImport.stripsPlaceHint'),
    });
    void deliverExport(new Blob([svg], { type: 'image/svg+xml' }), MEASURING_STRIPS_FILENAME);
    trackEvent('scan_measuring_strips_download');
  }, [t]);

  const handleConfirm = useCallback(() => {
    if (stage.kind !== 'review') return;
    const targetMm = scaleTargetMm(stage.targetText);
    if (targetMm === null) return;

    const rescaled = rescaleToLongestMm(stage.parsed.specs, stage.parsed.sized.longest, targetMm);
    const count = addScanCutouts(rescaled);
    trackEvent('scan_import', { success: true, shape_count: count, target_mm: targetMm });
    addToast(t('toast.scanImport.success', { count }), 'success');
    setAdded((n) => n + count);
    setStage({ kind: 'awaiting' });
  }, [stage, addScanCutouts, addToast, t]);

  // One handoff session from picking the phone route until the dialog closes,
  // so several tools can be scanned in a row; the scale-confirm step pauses on
  // its own UI, not the poll.
  const scan = useScanSession(open && phoneStarted, ingestSvg, sessionAttempt);

  const targetMm = stage.kind === 'review' ? scaleTargetMm(stage.targetText) : null;
  const targetValid = targetMm !== null;

  return (
    <>
      <Dialog.Root open={open} onClose={handleClose} size="md">
        <Dialog.Header title={t('binDesigner.cutouts.scanImport.title')} />
        <Dialog.Body>
          {stage.kind === 'awaiting' ? (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              {added > 0 && (
                <p className="flex w-full items-center justify-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="shrink-0"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {t(
                    added === 1
                      ? 'binDesigner.cutouts.scanImport.added.one'
                      : 'binDesigner.cutouts.scanImport.added.other',
                    { count: added }
                  )}
                </p>
              )}
              {route === 'choose' ? (
                <ScanRouteChoice
                  phoneCardRef={phoneCardRef}
                  onPhone={() => {
                    if (scan.phase === 'unavailable' || scan.phase === 'expired') {
                      setSessionAttempt((n) => n + 1);
                    }
                    setPhoneStarted(true);
                    focusOnRoute.current = true;
                    setRoute('phone');
                  }}
                  onComputer={() => setTracing(true)}
                />
              ) : (
                <ScanPhoneRoute
                  scan={scan}
                  backButtonRef={backButtonRef}
                  onBack={() => {
                    focusOnRoute.current = true;
                    setRoute('choose');
                  }}
                  onDownloadSheet={handleDownloadSheet}
                  onDownloadStrips={handleDownloadStrips}
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="text-content-tertiary"
              >
                {t('binDesigner.cutouts.scanImport.upload')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".svg,image/svg+xml"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />
            </div>
          ) : (
            <ScanScaleField
              svg={stage.svg}
              parsed={stage.parsed}
              targetText={stage.targetText}
              onChange={(text) => setStage({ ...stage, targetText: text })}
            />
          )}
        </Dialog.Body>
        <Dialog.Footer>
          {stage.kind === 'review' ? (
            <>
              <Button type="button" variant="ghost" onClick={() => setStage({ kind: 'awaiting' })}>
                {t('binDesigner.cutouts.scanImport.back')}
              </Button>
              <Button type="button" variant="ghost" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!targetValid}
                onClick={handleConfirm}
              >
                {t('binDesigner.cutouts.scanImport.add')}
              </Button>
            </>
          ) : added > 0 ? (
            <Button type="button" variant="primary" onClick={handleClose}>
              {t('binDesigner.cutouts.scanImport.done')}
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
          )}
        </Dialog.Footer>
      </Dialog.Root>
      {/* Outside the dialog's tree: events from a portal still bubble through
        React parents, and this one's would reach the dialog's handlers. */}
      {open && (tracing || photo) && (
        <Suspense fallback={null}>
          <TraceView
            open
            initialPhoto={photo}
            onClose={() => {
              setTracing(false);
              onPhotoDone?.();
            }}
            onTraced={(svg) => ingestSvg(svg, 'desktop')}
          />
        </Suspense>
      )}
    </>
  );
}

interface ScanPhoneRouteProps {
  readonly scan: ScanSessionState;
  readonly onBack: () => void;
  readonly backButtonRef: RefObject<HTMLButtonElement | null>;
  readonly onDownloadSheet: () => void;
  readonly onDownloadStrips: () => void;
}

function ScanPhoneRoute({
  scan,
  onBack,
  backButtonRef,
  onDownloadSheet,
  onDownloadStrips,
}: ScanPhoneRouteProps) {
  const t = useTranslation();
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        ref={backButtonRef}
        onClick={onBack}
        leftIcon={<ArrowLeftIcon size="xs" />}
        className="self-start"
      >
        {t('binDesigner.cutouts.scanImport.back')}
      </Button>
      {scan.phase === 'unavailable' || scan.phase === 'expired' ? (
        <p className="text-sm text-content-secondary">
          {t(
            scan.phase === 'expired'
              ? 'binDesigner.cutouts.scanImport.expired'
              : 'binDesigner.cutouts.scanImport.unavailable'
          )}
        </p>
      ) : scan.phase === 'waiting' && scan.url ? (
        <>
          <ScanQrCode url={scan.url} alt={t('binDesigner.cutouts.scanImport.qrAlt')} />
          <p className="text-sm text-content-secondary">
            {t('binDesigner.cutouts.scanImport.hint')}
          </p>
          {/* Fallback if the QR can't be scanned/rendered: the link itself. */}
          <p className="max-w-full break-all font-mono text-micro text-content-tertiary">
            {scan.url}
          </p>
          <p className="flex items-center gap-2 text-xs text-content-tertiary">
            <Spinner size="sm" />
            {t('binDesigner.cutouts.scanImport.waiting')}
          </p>
          <div className="flex w-full flex-col items-center gap-1 rounded-lg border border-stroke-subtle bg-surface-elevated px-3 py-2.5">
            <Button type="button" variant="ghost" size="sm" onClick={onDownloadSheet}>
              {t('binDesigner.cutouts.scanImport.calibrationSheet')}
            </Button>
            <p className="text-xs text-content-tertiary">
              {t('binDesigner.cutouts.scanImport.calibrationSheetHelp')}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={onDownloadStrips}>
              {t('binDesigner.cutouts.scanImport.measuringStrips')}
            </Button>
            <p className="text-xs text-content-tertiary">
              {t('binDesigner.cutouts.scanImport.measuringStripsHelp')}
            </p>
          </div>
          <PrivacyHint text={t('scan.capture.privacy')} />
        </>
      ) : (
        <p className="flex items-center gap-2 py-6 text-sm text-content-secondary">
          <Spinner size="sm" />
          {t('binDesigner.cutouts.scanImport.waiting')}
        </p>
      )}
    </>
  );
}

function PrivacyHint({ text }: { readonly text: string }) {
  return (
    <span className="flex items-center justify-center gap-1.5 text-label text-content-tertiary">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      {text}
    </span>
  );
}
