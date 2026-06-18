/**
 * "Scan with your phone" dialog.
 *
 * Shows a QR code that opens the phone capture page; when the phone uploads a
 * traced outline it arrives here and moves to the scale-confirm step. A manual
 * SVG upload is always offered as a fallback. The outline carries no real-world
 * scale, so the user confirms the longest side in mm before it becomes a cutout.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Dialog, Button, Input, Spinner } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useToastStore } from '@/core/store/toast';
import { trackEvent } from '@/shared/analytics/posthog';
import { isOk } from '@/core/result';
import { MAX_SVG_FILE_SIZE } from '../svgImport/types';
import { parseScanSvg, rescaleToLongestMm, type ParsedScan } from './scanIngest';
import { useScanImport } from './useScanImport';
import { useScanSession } from './useScanSession';
import { ScanQrCode } from './ScanQrCode';

interface ScanWithPhoneDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

type Stage =
  | { readonly kind: 'awaiting' }
  | {
      readonly kind: 'review';
      readonly svg: string;
      readonly parsed: ParsedScan;
      readonly targetText: string;
    };

const round1 = (n: number): number => Math.round(n * 10) / 10;

function PrivacyHint({ text }: { readonly text: string }) {
  return (
    <span className="flex items-center justify-center gap-1.5 text-[11px] text-content-tertiary">
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

export function ScanWithPhoneDialog({ open, onClose }: ScanWithPhoneDialogProps) {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const { addScanCutouts } = useScanImport();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fieldId = useId();
  const [stage, setStage] = useState<Stage>({ kind: 'awaiting' });
  const [added, setAdded] = useState(0);

  // A scan can arrive mid scale-confirm; read the live stage from a ref (the
  // poll fires outside render) and hold the latecomer until we're back to
  // awaiting, rather than clobbering the in-progress confirmation.
  const stageRef = useRef(stage);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);
  const pendingScanRef = useRef<string | null>(null);

  // Preview via a Blob URL rather than a data: URL — avoids encoding a
  // potentially multi-MB SVG into a string on every render.
  const reviewSvg = stage.kind === 'review' ? stage.svg : null;
  const previewUrl = useMemo(
    () =>
      reviewSvg ? URL.createObjectURL(new Blob([reviewSvg], { type: 'image/svg+xml' })) : null,
    [reviewSvg]
  );
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleClose = useCallback(() => {
    setStage({ kind: 'awaiting' });
    setAdded(0);
    pendingScanRef.current = null;
    onClose();
  }, [onClose]);

  const ingestSvg = useCallback(
    (svg: string) => {
      const result = parseScanSvg(svg);
      if (!isOk(result)) {
        addToast(t('toast.scanImport.parseFailed'), 'error');
        trackEvent('scan_import', { success: false, error_code: result.error.code });
        return;
      }
      // The phone already rectified to true mm (a card was in frame), so the
      // specs are to scale — add them directly and skip the scale-confirm step.
      if (/data-scan-units\s*=\s*["']mm["']/.test(svg)) {
        const count = addScanCutouts(result.value.specs);
        trackEvent('scan_import', { success: true, shape_count: count, source: 'phone_mm' });
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

  const handleConfirm = useCallback(() => {
    if (stage.kind !== 'review') return;
    const targetMm = parseFloat(stage.targetText);
    if (!Number.isFinite(targetMm) || targetMm <= 0) return;

    const rescaled = rescaleToLongestMm(stage.parsed.specs, stage.parsed.bounds.longest, targetMm);
    const count = addScanCutouts(rescaled);
    trackEvent('scan_import', { success: true, shape_count: count, target_mm: targetMm });
    addToast(t('toast.scanImport.success', { count }), 'success');
    setAdded((n) => n + count);
    setStage({ kind: 'awaiting' });
  }, [stage, addScanCutouts, addToast, t]);

  // One handoff session for the dialog's lifetime so several tools can be
  // scanned in a row; the scale-confirm step pauses on its own UI, not the poll.
  const scan = useScanSession(open, ingestSvg);

  const targetMm = stage.kind === 'review' ? parseFloat(stage.targetText) : NaN;
  const targetValid = Number.isFinite(targetMm) && targetMm > 0;
  const factor =
    stage.kind === 'review' && targetValid ? targetMm / stage.parsed.bounds.longest : 1;

  return (
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
                {t('binDesigner.cutouts.scanImport.added', { count: added })}
              </p>
            )}
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
                <p className="max-w-full break-all font-mono text-[10px] text-content-tertiary">
                  {scan.url}
                </p>
                <p className="flex items-center gap-2 text-xs text-content-tertiary">
                  <Spinner size="sm" />
                  {t('binDesigner.cutouts.scanImport.waiting')}
                </p>
                <PrivacyHint text={t('scan.capture.privacy')} />
              </>
            ) : (
              <p className="flex items-center gap-2 py-6 text-sm text-content-secondary">
                <Spinner size="sm" />
                {t('binDesigner.cutouts.scanImport.waiting')}
              </p>
            )}

            <div className="flex w-full items-center gap-3 text-xs text-content-tertiary">
              <span className="h-px flex-1 bg-stroke-subtle" />
              {t('binDesigner.cutouts.scanImport.or')}
              <span className="h-px flex-1 bg-stroke-subtle" />
            </div>

            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
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
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-center rounded-md border border-stroke-subtle bg-surface-elevated p-3">
              <img
                src={previewUrl ?? undefined}
                alt={t('binDesigner.cutouts.scanImport.previewAlt')}
                className="max-h-48 w-auto"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={fieldId} className="text-sm font-medium text-content-primary">
                {t('binDesigner.cutouts.scanImport.scaleLabel')}
              </label>
              <Input
                id={fieldId}
                type="number"
                min={0}
                step={0.5}
                value={stage.targetText}
                error={stage.targetText !== '' && !targetValid}
                onChange={(e) => setStage({ ...stage, targetText: e.target.value })}
              />
              <p className="text-xs text-content-tertiary">
                {t('binDesigner.cutouts.scanImport.scaleHelp')}
              </p>
              {targetValid && (
                <p className="text-xs text-content-secondary">
                  {t('binDesigner.cutouts.scanImport.resultSize', {
                    width: round1(stage.parsed.bounds.width * factor),
                    depth: round1(stage.parsed.bounds.depth * factor),
                  })}
                </p>
              )}
            </div>
          </div>
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
            <Button type="button" variant="primary" disabled={!targetValid} onClick={handleConfirm}>
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
  );
}
