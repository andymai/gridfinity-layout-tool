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
import { dispatchSyntheticPopstate, useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useDesignerStore } from '@/features/bin-designer/store';
import { canStartScan, startScan } from '@/features/bin-designer/utils/startScan';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { settleDesignSaves } from './designSaveGate';
import { useVariantContext } from './useVariantContext';

/** A request older than this is from a navigation that never arrived; drop it. */
export const SCAN_LAUNCH_STALE_MS = 15_000;

export function useScanLaunchBridge(): void {
  const request = useScanLaunchStore((s) => s.request);
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const { syncUrlToDesign } = useDesignerRouting();
  const { isDesktop } = useResponsive();
  // A variant's params are its parent's to change (the panel is locked for the
  // same reason), so a scan never lands in one; it starts a new bin instead.
  const variant = useVariantContext(currentDesignId);
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
    // Saved defaults can leave a new bin unable to take cutouts (a spacer or
    // tile body, an interior lightweight floor); a bin made for a scan starts
    // from the factory base instead, or the factory bin if that isn't enough.
    const { params, setParams } = useDesignerStore.getState();
    if (!canStartScan(params)) {
      setParams({ base: DEFAULT_BIN_PARAMS.base });
      if (!canStartScan(useDesignerStore.getState().params)) setParams({ ...DEFAULT_BIN_PARAMS });
    }
    startScan(pending.source, { growBin: true, phone: !isDesktop });
  }, [currentDesignId, isDesktop]);

  useEffect(() => {
    if (!request) return;
    // One launch at a time: a request made while a new bin is on its way is
    // dropped, not queued behind it.
    if (busy.current || awaitingNewBin.current) {
      useScanLaunchStore.getState().takeRequest();
      return;
    }
    if (currentDesignId === null || variant.isLoading) return;
    const taken = useScanLaunchStore.getState().takeRequest();
    if (!taken || Date.now() - taken.requestedAt > SCAN_LAUNCH_STALE_MS) return;

    const { itemKind, params } = useDesignerStore.getState();
    if (!taken.newBin && itemKind === 'bin' && !variant.isVariant && canStartScan(params)) {
      startScan(taken.source, { phone: !isDesktop });
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
      // Each routing hook keeps its own copy of the URL; init's copy has to
      // drop the old id too, or it waits on that id and never makes the bin.
      dispatchSyntheticPopstate();
    });
  }, [request, currentDesignId, isDesktop, syncUrlToDesign, variant.isLoading, variant.isVariant]);
}
