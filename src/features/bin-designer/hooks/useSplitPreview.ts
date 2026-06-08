/**
 * Drives split bin piece mesh generation for the 3D preview.
 *
 * Two paths feed the same `splitPieceMeshes` slot, arbitrated by a monotonic
 * token so the most recent edit always wins:
 *
 * 1. **Draft (Manifold)** — fires immediately on each edit via the separate
 *    Manifold preview bridge (~7× faster than occt-wasm), so the split pieces
 *    appear in a few hundred ms instead of waiting for the full exact pipeline.
 * 2. **Exact (occt-wasm)** — runs after the main bin generation completes, so
 *    the worker's cached solid matches the current params, and supersedes the
 *    draft. Distributes pieces across the worker pool when available.
 *
 * A draft is dropped if a newer edit has started (`token !== genToken`) or the
 * exact result for its edit already landed (`token <= finalizedToken`). The
 * exact result records its token as finalized so a slow draft can't clobber it.
 *
 * Clears meshes when the bin no longer needs splitting.
 */

import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import { calcMaxGridUnits } from '@/core/constants';
import { getActiveBridge, workerPoolManager, bridgeManager } from '@/shared/generation/bridge';
import type { GenerationBridge, SplitPreviewResult } from '@/shared/generation/bridge';
import { getSplitPieceCount, getSplitPlanePositionsMm } from '@/shared/utils/splitPositions';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/shared/types/bin';
import type { SplitPieceMeshEntry } from '../types';

interface SplitInputs {
  readonly cutPlanesX: number[];
  readonly cutPlanesY: number[];
  readonly totalPieceCount: number;
  readonly splitConnectorConfig: BinParams['splitConnectors'];
}

function computeSplitInputs(
  params: BinParams,
  maxGrid: { width: number; depth: number }
): SplitInputs {
  return {
    cutPlanesX: getSplitPlanePositionsMm(params.width, maxGrid.width, params.gridUnitMm),
    cutPlanesY: getSplitPlanePositionsMm(params.depth, maxGrid.depth, params.gridUnitMm),
    totalPieceCount: getSplitPieceCount(params.width, params.depth, maxGrid.width, maxGrid.depth),
    splitConnectorConfig: params.splitConnectors ?? DEFAULT_SPLIT_CONNECTOR_CONFIG,
  };
}

/** Convert a worker SplitPreviewResult into the store's mesh-entry shape. */
function toMeshEntries(result: SplitPreviewResult): SplitPieceMeshEntry[] {
  return result.pieces.map(({ vertices, normals, indices, edgeVertices, ...metadata }) => ({
    ...metadata,
    mesh: { vertices, normals, indices, edgeVertices },
  }));
}

export function useSplitPreview(): void {
  const { generationStatus, params } = useDesignerStore(
    useShallow((s) => ({
      generationStatus: s.generation.status,
      params: s.params,
    }))
  );

  const { defaultPrintBedSize, defaultPrintBedDepth } = useSettingsStore(
    useShallow((s) => ({
      defaultPrintBedSize: s.settings.defaultPrintBedSize,
      defaultPrintBedDepth: s.settings.defaultPrintBedDepth,
    }))
  );

  // Use params.gridUnitMm (the bin's actual grid unit) rather than
  // defaultGridUnitMm from settings, which may be stale
  const maxGrid = calcMaxGridUnits(defaultPrintBedSize, params.gridUnitMm, defaultPrintBedDepth);
  const needsSplit = params.width > maxGrid.width || params.depth > maxGrid.depth;

  // Monotonic per-edit token; the most recent dispatch wins. finalizedToken is
  // the highest token whose EXACT result has been applied — drafts at or below
  // it are stale (covers the exact-resolves-before-draft race).
  const genTokenRef = useRef(0);
  const finalizedTokenRef = useRef(0);
  const prevStatusRef = useRef(generationStatus);
  const previewBridgeRef = useRef<GenerationBridge | null>(null);
  // Flips true once the Manifold bridge is acquired so the draft effect re-runs
  // and dispatches a draft for the current params (the bridge usually resolves
  // after the first render, so the initial edit would otherwise miss its draft).
  const [previewReady, setPreviewReady] = useState(false);

  // Acquire the Manifold draft-preview bridge (null when the flag is off or the
  // kernel fails to load — never fatal; the exact path still runs).
  useEffect(() => {
    let acquired = false;
    let cancelled = false;
    void bridgeManager
      .acquirePreview()
      .then((preview) => {
        if (cancelled) {
          if (preview) bridgeManager.releasePreview();
          return;
        }
        if (!preview) return;
        previewBridgeRef.current = preview;
        acquired = true;
        setPreviewReady(true);
      })
      .catch(() => {
        // Draft preview unavailable; exact-only split proceeds.
      });
    return () => {
      cancelled = true;
      previewBridgeRef.current = null;
      setPreviewReady(false);
      if (acquired) bridgeManager.releasePreview();
    };
  }, []);

  // Draft path: render a fast Manifold split on the leading edge of each edit,
  // without waiting for the exact main generation to finish.
  useEffect(() => {
    if (!needsSplit) return;
    const preview = previewBridgeRef.current;
    if (!preview || preview.isDestroyed) return;

    const token = ++genTokenRef.current;
    const { cutPlanesX, cutPlanesY, splitConnectorConfig } = computeSplitInputs(params, maxGrid);

    void preview
      .generateSplitPreview(params, cutPlanesX, cutPlanesY, { splitConnectorConfig })
      .then((result) => {
        // Dropped if a newer edit started or this edit's exact result landed.
        if (token !== genTokenRef.current || token <= finalizedTokenRef.current) return;
        useDesignerStore.getState().setSplitPieceMeshes(toMeshEntries(result));
      })
      .catch(() => {
        // Draft failure is non-fatal — the exact path still runs.
      });
  }, [needsSplit, params, maxGrid, previewReady]);

  // Exact path: runs after the main bin generation finishes so the worker's
  // cached solid matches the current params, then supersedes the draft.
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = generationStatus;

    if (!needsSplit) {
      const current = useDesignerStore.getState().ui.splitPieceMeshes;
      if (current.length > 0) {
        useDesignerStore.getState().setSplitPieceMeshes([]);
      }
      return;
    }

    // On first load, 'idle' → 'complete' counts as a valid transition.
    const justCompleted =
      generationStatus === 'complete' && (prevStatus === 'generating' || prevStatus === 'idle');

    if (!justCompleted) return;

    const bridge = getActiveBridge();
    if (!bridge) return;

    // Claim a fresh token so a stale exact (from a superseded edit) can't
    // overwrite a newer one, and finalize it on success so a slow draft for an
    // earlier edit is dropped. Bumping past any in-flight draft for this same
    // edit is fine — by justCompleted the draft has already served its purpose.
    const token = ++genTokenRef.current;
    const { cutPlanesX, cutPlanesY, totalPieceCount, splitConnectorConfig } = computeSplitInputs(
      params,
      maxGrid
    );

    // Try to acquire the pool for parallel generation, fall back to single bridge.
    // acquire() is ref-counted so the pool stays alive for the duration of the operation.
    let usingPool = false;
    const resultPromise = workerPoolManager
      .acquire()
      .then((pool) => {
        if (pool.size <= 1) {
          workerPoolManager.release();
          return bridge.generateSplitPreview(params, cutPlanesX, cutPlanesY, {
            splitConnectorConfig,
          });
        }
        usingPool = true;
        return pool.generateSplitPreview(params, cutPlanesX, cutPlanesY, totalPieceCount, {
          splitConnectorConfig,
        });
      })
      .catch(() =>
        // Pool unavailable — fall back to single bridge
        bridge.generateSplitPreview(params, cutPlanesX, cutPlanesY, {
          splitConnectorConfig,
        })
      );

    resultPromise
      .then((result) => {
        if (token !== genTokenRef.current) return;
        finalizedTokenRef.current = token;
        useDesignerStore.getState().setSplitPieceMeshes(toMeshEntries(result));
      })
      .catch(() => {
        // Silently ignore errors (e.g., superseded requests)
      })
      .finally(() => {
        if (usingPool) workerPoolManager.release();
      });
  }, [needsSplit, generationStatus, params, maxGrid]);
}
