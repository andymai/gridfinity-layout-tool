/**
 * Drives split bin piece mesh generation for the 3D preview.
 *
 * Waits for the main bin generation to complete (generating → complete
 * transition) before generating split pieces, so the worker's cached
 * solid matches the current params. Without this gating, a param change
 * would trigger an immediate split preview against the stale solid,
 * producing mismatched geometry that flashes before the correct version.
 *
 * When a worker pool is available, distributes piece processing across
 * multiple workers in parallel. Falls back to the single bridge otherwise.
 *
 * Clears meshes when the bin no longer needs splitting.
 */

import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import { calcMaxGridUnits } from '@/core/constants';
import { getActiveBridge, workerPoolManager } from '@/shared/generation/bridge';
import {
  getSplitPieceCount,
  getSplitPlanePositionsMm,
} from '@/features/bin-designer/utils/splitPositions';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { SplitPieceMeshEntry } from '../types';

export function useSplitPreview(): void {
  const { generationStatus, params } = useDesignerStore(
    useShallow((s) => ({
      generationStatus: s.generation.status,
      params: s.params,
    }))
  );

  const { defaultPrintBedSize, defaultGridUnitMm } = useSettingsStore(
    useShallow((s) => ({
      defaultPrintBedSize: s.settings.defaultPrintBedSize,
      defaultGridUnitMm: s.settings.defaultGridUnitMm,
    }))
  );

  const maxGridUnits = calcMaxGridUnits(defaultPrintBedSize, defaultGridUnitMm);
  const needsSplit = params.width > maxGridUnits || params.depth > maxGridUnits;

  const requestIdRef = useRef(0);
  const prevStatusRef = useRef(generationStatus);

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

    // Only generate split preview after the main bin generation finishes.
    // This ensures the worker's cached solid matches the current params.
    // On first load, 'idle' → 'complete' counts as a valid transition.
    const justCompleted =
      generationStatus === 'complete' && (prevStatus === 'generating' || prevStatus === 'idle');

    if (!justCompleted) return;

    const bridge = getActiveBridge();
    if (!bridge) return;

    const requestId = ++requestIdRef.current;
    const cutPlanesX = getSplitPlanePositionsMm(params.width, maxGridUnits, params.gridUnitMm);
    const cutPlanesY = getSplitPlanePositionsMm(params.depth, maxGridUnits, params.gridUnitMm);
    const connectorConfig = params.splitConnectors ?? DEFAULT_SPLIT_CONNECTOR_CONFIG;
    const totalPieceCount = getSplitPieceCount(params.width, params.depth, maxGridUnits);

    const pool = workerPoolManager.get();

    const resultPromise =
      pool && !pool.isDestroyed && pool.size > 1
        ? pool.generateSplitPreview(params, cutPlanesX, cutPlanesY, totalPieceCount, {
            splitConnectorConfig: connectorConfig,
          })
        : bridge.generateSplitPreview(params, cutPlanesX, cutPlanesY, {
            splitConnectorConfig: connectorConfig,
          });

    resultPromise
      .then((result) => {
        if (requestIdRef.current !== requestId) return;

        const entries: SplitPieceMeshEntry[] = result.pieces.map(
          ({ vertices, normals, indices, edgeVertices, ...metadata }) => ({
            ...metadata,
            mesh: { vertices, normals, indices, edgeVertices },
          })
        );

        useDesignerStore.getState().setSplitPieceMeshes(entries);
      })
      .catch(() => {
        // Silently ignore errors (e.g., superseded requests)
      });
  }, [needsSplit, generationStatus, params, maxGridUnits]);
}
