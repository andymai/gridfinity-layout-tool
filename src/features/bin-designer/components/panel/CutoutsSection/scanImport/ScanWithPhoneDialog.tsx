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

export function ScanWithPhoneDialog({ open, onClose }: ScanWithPhoneDialogProps) {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const { addScanCutouts } = useScanImport();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fieldId = useId();
  const [stage, setStage] = useState<Stage>({ kind: 'awaiting' });

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
        handleClose();
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
    [addToast, t, addScanCutouts, handleClose]
  );

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
    handleClose();
  }, [stage, addScanCutouts, addToast, t, handleClose]);

  // Open a handoff session (and poll it) only while awaiting a scan.
  const scan = useScanSession(open && stage.kind === 'awaiting', ingestSvg);

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
        {stage.kind === 'review' && (
          <Button type="button" variant="ghost" onClick={() => setStage({ kind: 'awaiting' })}>
            {t('binDesigner.cutouts.scanImport.back')}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={handleClose}>
          {t('common.cancel')}
        </Button>
        {stage.kind === 'review' && (
          <Button type="button" variant="primary" disabled={!targetValid} onClick={handleConfirm}>
            {t('binDesigner.cutouts.scanImport.add')}
          </Button>
        )}
      </Dialog.Footer>
    </Dialog.Root>
  );
}
