/**
 * URL ↔ Designer store synchronization hook.
 *
 * Handles two directions of sync:
 * 1. URL → Store: On mount or popstate, if URL has ?id=xyz, load that design
 * 2. Store → URL: When currentDesignId changes (e.g., auto-save creates new),
 *    update URL silently (replaceState)
 *
 * This enables:
 * - Deep linking to specific designs (/designer?id=abc123)
 * - Browser back/forward navigation between designs
 * - URL stays in sync after auto-save without polluting history
 */

import { useEffect, useRef } from 'react';
import { isOk, getUserMessage } from '@/core/result';
import { designId } from '@/core/types';
import { loadDesign } from '@/features/bin-designer/storage/DesignerStorage';
import { useDesignerStore } from '../store';
import { settleDesignSaves } from './designSaveGate';
import type { BinParams, ExportFileNameConfig } from '../types';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';

const MAX_SWITCH_ATTEMPTS = 3;

interface EditorSnapshot {
  readonly params: BinParams;
  readonly config: ExportFileNameConfig;
}

function editorSnapshot(): EditorSnapshot {
  const state = useDesignerStore.getState();
  return { params: state.params, config: state.exportFileNameConfig };
}

function sameSnapshot(a: EditorSnapshot, b: EditorSnapshot): boolean {
  return a.params === b.params && a.config === b.config;
}

/** Read through a call so a check after an await is not narrowed by the one before it. */
function isSuperseded(request: { superseded: boolean }): boolean {
  return request.superseded;
}

/**
 * Synchronizes the designer's current design with the URL.
 * Must be called inside the DesignerPage component.
 */
export function useDesignerUrlSync(): void {
  const { designIdFromUrl, syncUrlToDesign } = useDesignerRouting();
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const storeLoadDesign = useDesignerStore((s) => s.loadDesign);
  const setSaveStatus = useDesignerStore((s) => s.setSaveStatus);
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();

  // Track whether we're handling initial mount vs ongoing changes
  const mountedRef = useRef(false);
  // Track whether we triggered a design load ourselves (to avoid re-sync loops)
  const loadingFromUrlRef = useRef(false);
  // Track last known URL ID to avoid redundant loads
  const lastUrlIdRef = useRef<string | null>(designIdFromUrl);

  // Direction 1: URL → Store (load design when URL changes)
  useEffect(() => {
    // Skip if the URL ID hasn't actually changed
    if (designIdFromUrl === lastUrlIdRef.current && mountedRef.current) return;
    lastUrlIdRef.current = designIdFromUrl;

    if (!designIdFromUrl) {
      mountedRef.current = true;
      return;
    }

    // Don't reload if we're already viewing this design
    if (designIdFromUrl === currentDesignId) {
      mountedRef.current = true;
      return;
    }

    loadingFromUrlRef.current = true;

    const requestedId = designId(designIdFromUrl);
    const openId = currentDesignId;
    const request = { superseded: false, done: false };

    void (async () => {
      let result: Awaited<ReturnType<typeof loadDesign>> | null = null;
      for (let attempt = 0; attempt < MAX_SWITCH_ATTEMPTS && result === null; attempt += 1) {
        const saved = await settleDesignSaves();
        if (isSuperseded(request)) return;
        if (!saved) break;
        const outgoing = editorSnapshot();
        const read = await loadDesign(requestedId);
        if (isSuperseded(request)) return;
        // An edit made during the read can change what it should have seen (a
        // parent rewrites its variants), so it gets another settle and read.
        if (sameSnapshot(outgoing, editorSnapshot())) result = read;
      }
      request.done = true;
      if (result === null) {
        // The open design's edits are not all in storage. Keep it open rather
        // than replace the only copy of them.
        addToast({ message: t('header.saveFailed'), type: 'error', duration: 4000 });
        setSaveStatus('error');
        syncUrlToDesign(openId);
      } else if (isOk(result)) {
        storeLoadDesign(result.value);
      } else {
        addToast({ message: getUserMessage(result.error), type: 'error', duration: 4000 });
        syncUrlToDesign(null);
      }
      loadingFromUrlRef.current = false;
      mountedRef.current = true;
    })();

    return () => {
      if (request.done) return;
      // Superseded before it applied anything, by Back or another pick. Forget
      // it, so a rerun for the same URL starts over instead of reading as done.
      request.superseded = true;
      lastUrlIdRef.current = null;
      loadingFromUrlRef.current = false;
    };
  }, [
    designIdFromUrl,
    currentDesignId,
    storeLoadDesign,
    addToast,
    syncUrlToDesign,
    setSaveStatus,
    t,
  ]);

  // Direction 2: Store → URL (sync URL when design ID changes)
  useEffect(() => {
    // Skip initial mount (wait for URL load to complete first)
    if (!mountedRef.current) return;
    // Skip if we're the ones who just loaded from URL
    if (loadingFromUrlRef.current) return;
    // Skip if already in sync
    if (currentDesignId === lastUrlIdRef.current) return;

    lastUrlIdRef.current = currentDesignId;
    syncUrlToDesign(currentDesignId);
  }, [currentDesignId, syncUrlToDesign]);
}
