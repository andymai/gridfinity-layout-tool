/**
 * Runs "Scan a tool" requests made outside the designer's panel: the command
 * palette and What's New. Those features cannot import this one, so they leave
 * a request in `useScanLaunchStore`; this hook, mounted by `DesignerPage`,
 * picks it up once a design is loaded.
 */

import { useEffect, useRef } from 'react';
import { useToastStore } from '@/core/store/toast';
import { useScanLaunchStore, type ScanLaunchSource } from '@/core/store/scanLaunch';
import { getStaticTranslation } from '@/i18n';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useDesignerStore } from '@/features/bin-designer/store';
import { canStartScan, startScan } from '@/features/bin-designer/utils/startScan';
import { settleDesignSaves } from './designSaveGate';

/** A request older than this is from a navigation that never arrived; drop it. */
export const SCAN_LAUNCH_STALE_MS = 15_000;

export function useScanLaunchBridge(): void {
  const request = useScanLaunchStore((s) => s.request);
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const { syncUrlToDesign } = useDesignerRouting();
  const { isDesktop } = useResponsive();
  const busy = useRef(false);
  // A new bin takes two steps: `newDesign()` clears the id, and the scan opens
  // once init assigns the fresh one, so auto-save tracks the bin it lands in.
  const awaitingNewBin = useRef<ScanLaunchSource | null>(null);

  useEffect(() => {
    if (!request || currentDesignId === null || busy.current || awaitingNewBin.current) return;
    const taken = useScanLaunchStore.getState().takeRequest();
    if (!taken || Date.now() - taken.requestedAt > SCAN_LAUNCH_STALE_MS || !isDesktop) return;

    const { itemKind, params } = useDesignerStore.getState();
    if (!taken.newBin && itemKind === 'bin' && canStartScan(params)) {
      startScan(taken.source);
      return;
    }

    busy.current = true;
    const fromId = currentDesignId;
    void settleDesignSaves().then((saved) => {
      busy.current = false;
      if (useDesignerStore.getState().currentDesignId !== fromId) return;
      if (!saved) {
        useToastStore.getState().addToast({
          message: getStaticTranslation('header.saveFailed'),
          type: 'error',
          duration: 4000,
        });
        return;
      }
      awaitingNewBin.current = taken.source;
      useDesignerStore.getState().newDesign();
      syncUrlToDesign(null);
    });
  }, [request, currentDesignId, isDesktop, syncUrlToDesign]);

  useEffect(() => {
    const source = awaitingNewBin.current;
    if (source === null || currentDesignId === null) return;
    awaitingNewBin.current = null;
    startScan(source, { growBin: true });
  }, [currentDesignId]);
}
