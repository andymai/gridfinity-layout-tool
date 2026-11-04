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
  const awaitingNewBin = useRef<{
    readonly source: ScanLaunchSource;
    readonly since: number;
  } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Before the request effect, so a fresh id finishes the pending bin first. A
  // bin init never gave an id to is abandoned rather than opened on whatever
  // design turns up later.
  useEffect(() => {
    const pending = awaitingNewBin.current;
    if (pending === null || currentDesignId === null) return;
    awaitingNewBin.current = null;
    if (Date.now() - pending.since > SCAN_LAUNCH_STALE_MS) return;
    startScan(pending.source, { growBin: true });
  }, [currentDesignId]);

  useEffect(() => {
    if (!request) return;
    // One launch at a time: a request made while a new bin is on its way is
    // dropped, not queued behind it.
    if (busy.current || awaitingNewBin.current) {
      useScanLaunchStore.getState().takeRequest();
      return;
    }
    if (currentDesignId === null) return;
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
      if (!mounted.current || useDesignerStore.getState().currentDesignId !== fromId) return;
      if (!saved) {
        useToastStore.getState().addToast({
          message: getStaticTranslation('header.saveFailed'),
          type: 'error',
          duration: 4000,
        });
        return;
      }
      awaitingNewBin.current = { source: taken.source, since: Date.now() };
      useDesignerStore.getState().newDesign();
      syncUrlToDesign(null);
    });
  }, [request, currentDesignId, isDesktop, syncUrlToDesign]);
}
