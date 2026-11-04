/**
 * Scanning on a phone or tablet, where the cut editor doesn't render: the
 * phone's own scan flow, full screen, adding what it traces straight to the
 * bin, packed and grown to fit. A scan with no size reference in the photo
 * asks for one real measurement first.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Button, Dialog, Spinner } from '@/design-system';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import { trackEvent } from '@/shared/analytics/posthog';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';
import type { ScanUseOutcome } from '@/shared/scanReview/components/ScanCaptureFlow';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  isScaledScan,
  parseScanSvg,
  rescaleToLongestMm,
  scaleTargetMm,
  useScanImport,
  type ParsedScan,
} from '../panel/CutoutsSection/scanImport';
import { ScanScaleField } from '../panel/CutoutsSection/scanImport/ScanScaleField';
import { offFloorIds } from '../panel/CutoutsSection/packIntoBin';
import type { ParsedCutoutSpec } from '../panel/CutoutsSection/svgImport/types';

// The segmenter and its model load only once someone scans.
const ScanCaptureFlow = lazyWithRetry(() =>
  import('@/shared/scanReview/components/ScanCaptureFlow').then((m) => ({
    default: m.ScanCaptureFlow,
  }))
);

interface PendingScale {
  readonly svg: string;
  readonly parsed: ParsedScan;
}

export function PhoneScanDialog() {
  const t = useTranslation();
  const source = useDesignerStore((s) => s.ui.phoneScanSource);
  const closePhoneScan = useDesignerStore((s) => s.closePhoneScan);
  const addToast = useToastStore((s) => s.addToast);
  const { addScanCutouts } = useScanImport();
  const [pending, setPending] = useState<PendingScale | null>(null);
  const [targetText, setTargetText] = useState('');
  const open = source !== null;

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) trackEvent('scan_opened', { source });
    wasOpen.current = open;
  }, [open, source]);

  const close = useCallback(() => {
    setPending(null);
    setTargetText('');
    closePhoneScan();
  }, [closePhoneScan]);

  const land = useCallback(
    (specs: readonly ParsedCutoutSpec[], targetMm?: number) => {
      const before = offFloorIds(useDesignerStore.getState().params);
      const count = addScanCutouts(specs, undefined, { pack: true });
      // Packing grows the bin, but not past the size limit or a custom
      // footprint, and there's no editor here to show what didn't fit. A locked
      // pocket already off the floor isn't this scan's doing.
      const after = offFloorIds(useDesignerStore.getState().params);
      const offFloor = [...after].some((id) => !before.has(id));
      trackEvent('scan_import', {
        success: true,
        shape_count: count,
        source: 'phone_app',
        ...(targetMm === undefined ? {} : { target_mm: targetMm }),
      });
      if (offFloor) addToast(t('toast.scanImport.offFloor', { count }), 'info');
      else addToast(t('toast.scanImport.success', { count }), 'success');
      close();
    },
    [addScanCutouts, addToast, t, close]
  );

  const use = useCallback(
    (svg: string): Promise<ScanUseOutcome> => {
      const parsed = parseScanSvg(svg);
      if (!isOk(parsed)) {
        trackEvent('scan_import', { success: false, error_code: parsed.error.code });
        return Promise.resolve({ kind: 'error', messageKey: 'toast.scanImport.parseFailed' });
      }
      if (isScaledScan(svg)) {
        land(parsed.value.specs);
      } else {
        setTargetText('');
        setPending({ svg, parsed: parsed.value });
      }
      return Promise.resolve({ kind: 'taken' });
    },
    [land]
  );

  const targetMm = scaleTargetMm(targetText);

  return (
    <Dialog.Root
      open={open}
      onClose={close}
      size="5xl"
      fullScreen="always"
      closeOnOverlayClick={false}
    >
      <Dialog.Header title={t('binDesigner.cutouts.scanImport.title')} bordered />
      {pending ? (
        <>
          <Dialog.Body>
            <ScanScaleField
              svg={pending.svg}
              parsed={pending.parsed}
              targetText={targetText}
              onChange={setTargetText}
            />
          </Dialog.Body>
          <Dialog.Footer>
            <Button type="button" variant="ghost" onClick={() => setPending(null)}>
              {t('scan.retake')}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={targetMm === null}
              onClick={() => {
                if (targetMm === null) return;
                land(
                  rescaleToLongestMm(pending.parsed.specs, pending.parsed.sized.longest, targetMm),
                  targetMm
                );
              }}
            >
              {t('binDesigner.cutouts.scanImport.add')}
            </Button>
          </Dialog.Footer>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center">
                <Spinner size="md" />
              </div>
            }
          >
            <ScanCaptureFlow layout="embedded" onUse={use} />
          </Suspense>
        </div>
      )}
    </Dialog.Root>
  );
}
