import { useEffect, useRef, useState } from 'react';
import { SHARED_PREVIEW_ID } from '@/core/constants';
import { useLayoutStore, useLibraryStore, useSharedPreviewStore } from '@/core/store';
import { binId } from '@/core/types';
import type { BinId } from '@/core/types';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { parseLayoutFromURL } from '@/shared/utils/url';
import { useFocusBin } from './useFocusBin';

interface BinLink {
  readonly layoutId: string;
  readonly binId: BinId;
}

function readBinLink(): BinLink | null {
  const layout = parseLayoutFromURL();
  const bin = new URLSearchParams(window.location.search).get('bin');
  return layout && bin ? { layoutId: layout.layoutId, binId: binId(bin) } : null;
}

function dropBinParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('bin')) return;
  url.searchParams.delete('bin');
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}

/**
 * Opens a bin from a `/l/{id}/{slug}?bin={binId}` link. Routing activates the
 * layout; once it is active, the bin is selected on its layer and revealed, and
 * the parameter goes so a later mount does not jump again. The link is read on
 * mount, before routing can rewrite the URL to the canonical slug.
 */
export function useBinDeepLink(onLayoutRoute: boolean): void {
  const enabled = useFeatureFlag('places') && onLayoutRoute;
  const [link] = useState(readBinLink);
  const activeLayoutId = useLayoutStore((s) => s.activeLayoutId);
  const previewShareId = useSharedPreviewStore((s) => s.sharedPreview?.cloudShareId ?? null);
  const focusBin = useFocusBin();
  const handled = useRef(false);

  useEffect(() => {
    if (!enabled || link === null || handled.current || activeLayoutId === null) return;
    const entry = useLibraryStore.getState().getEntry(activeLayoutId);
    const opened =
      activeLayoutId === link.layoutId ||
      // A layout that re-shared under a fresh id answers to that share id too.
      entry?.cloudShare?.id === link.layoutId ||
      // Someone else's share opens as a preview under a fixed id.
      (activeLayoutId === SHARED_PREVIEW_ID && previewShareId === link.layoutId);
    if (!opened) return;
    handled.current = true;
    void focusBin(activeLayoutId, link.binId);
    dropBinParam();
  }, [enabled, link, activeLayoutId, previewShareId, focusBin]);
}
