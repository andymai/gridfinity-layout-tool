/**
 * Drives split bin piece mesh generation for the 3D preview.
 *
 * Watches `splitViewMode`, `needsSplit`, and generation status to trigger
 * the worker bridge's `generateSplitPreview()` when exploded mode is active
 * on an oversized bin. Stores results in the designer store for
 * `SplitBinMeshes` to render.
 */

import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import { calcMaxGridUnits } from '@/core/constants';
import { getActiveBridge } from '@/shared/generation/bridge';
import { getSplitPlanePositionsMm } from '@/features/bin-designer/utils/splitPositions';
import type { SplitPieceMeshEntry } from '../types';

/**
 * Trigger split preview mesh generation when exploded mode is active
 * on a bin that needs splitting. Clears meshes when switching to assembled
 * mode or when the bin no longer needs splitting.
 */
export function useSplitPreview(): void {
  const { splitViewMode, generationStatus, params } = useDesignerStore(
    useShallow((s) => ({
      splitViewMode: s.ui.splitViewMode,
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
  const isExploded = splitViewMode === 'exploded';
  const isIdle = generationStatus === 'idle';

  // Track the last request to avoid stale updates
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!isExploded || !needsSplit || !isIdle) {
      // Clear piece meshes when conditions aren't met
      const current = useDesignerStore.getState().ui.splitPieceMeshes;
      if (current.length > 0) {
        useDesignerStore.getState().setSplitPieceMeshes([]);
      }
      return;
    }

    const bridge = getActiveBridge();
    if (!bridge) return;

    const requestId = ++requestIdRef.current;
    const cutPlanesX = getSplitPlanePositionsMm(params.width, maxGridUnits, params.gridUnitMm);
    const cutPlanesY = getSplitPlanePositionsMm(params.depth, maxGridUnits, params.gridUnitMm);

    bridge
      .generateSplitPreview(params, cutPlanesX, cutPlanesY, {
        splitConnectorConfig: params.splitConnectors,
      })
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
  }, [isExploded, needsSplit, isIdle, params, maxGridUnits]);
}
