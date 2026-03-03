/**
 * Drives split bin piece mesh generation for the 3D preview.
 *
 * Triggers the worker bridge whenever the bin needs splitting.
 * Meshes are generated for both assembled and exploded modes — the view
 * mode only controls piece positioning in SplitBinMeshes.
 * Clears meshes when the bin no longer needs splitting.
 */

import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import { calcMaxGridUnits } from '@/core/constants';
import { getActiveBridge } from '@/shared/generation/bridge';
import { getSplitPlanePositionsMm } from '@/features/bin-designer/utils/splitPositions';
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
  const isReady = generationStatus === 'idle' || generationStatus === 'complete';

  const requestIdRef = useRef(0);

  useEffect(() => {
    // Only clear meshes when the bin no longer needs splitting.
    // During regeneration (!isReady), keep existing meshes visible so the
    // view doesn't flash between single-piece and split-piece renderers.
    if (!needsSplit) {
      const current = useDesignerStore.getState().ui.splitPieceMeshes;
      if (current.length > 0) {
        useDesignerStore.getState().setSplitPieceMeshes([]);
      }
      return;
    }

    if (!isReady) return;

    const bridge = getActiveBridge();
    if (!bridge) return;

    const requestId = ++requestIdRef.current;
    const cutPlanesX = getSplitPlanePositionsMm(params.width, maxGridUnits, params.gridUnitMm);
    const cutPlanesY = getSplitPlanePositionsMm(params.depth, maxGridUnits, params.gridUnitMm);

    bridge
      .generateSplitPreview(params, cutPlanesX, cutPlanesY, {
        splitConnectorConfig: params.splitConnectors ?? DEFAULT_SPLIT_CONNECTOR_CONFIG,
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
  }, [needsSplit, isReady, params, maxGridUnits]);
}
