/**
 * Hook that manages the GenerationBridge lifecycle for the standalone baseplate page.
 *
 * Lifecycle:
 * 1. Mount: Create bridge, init worker, set wasmStatus
 * 2. Params change: Regenerate BREP with actual padding values
 * 3. Unmount: Destroy bridge
 *
 * Padding is applied directly — pockets stay centered at origin, the slab
 * extends asymmetrically. This keeps the grid-aligned footprint stable
 * regardless of padding distribution.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { GenerationBridge, setActiveBridge } from '@/shared/generation/bridge';
import { trackWasmThreadingStatus } from '@/shared/analytics/posthog';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { buildFullParams } from '../utils/buildFullParams';
import type { BaseplateParams as FullBaseplateParams } from '@/shared/types/bin';

/**
 * Manages the GenerationBridge lifecycle and auto-regeneration
 * when layout params change.
 */
export function useBaseplateGeneration(): void {
  const bridgeRef = useRef<GenerationBridge | null>(null);
  const initializedRef = useRef(false);

  const {
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
    magnetHoles,
    magnetDiameter,
    magnetDepth,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack,
  } = useLayoutStore(
    useShallow((state) => {
      const bp = state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      return {
        drawerWidth: state.layout.drawer.width,
        drawerDepth: state.layout.drawer.depth,
        gridUnitMm: state.layout.gridUnitMm,
        fractionalEdgeX: state.layout.drawer.fractionalEdgeX ?? 'end',
        fractionalEdgeY: state.layout.drawer.fractionalEdgeY ?? 'end',
        magnetHoles: bp.magnetHoles,
        magnetDiameter: bp.magnetDiameter,
        magnetDepth: bp.magnetDepth,
        paddingLeft: bp.paddingLeft,
        paddingRight: bp.paddingRight,
        paddingFront: bp.paddingFront,
        paddingBack: bp.paddingBack,
      };
    })
  );

  const setGenerationStatus = useBaseplatePageStore((s) => s.setGenerationStatus);
  const setGenerationResult = useBaseplatePageStore((s) => s.setGenerationResult);
  const setWasmStatus = useBaseplatePageStore((s) => s.setWasmStatus);

  const runGeneration = useCallback(
    async (fullParams: FullBaseplateParams) => {
      const bridge = bridgeRef.current;
      if (!bridge || bridge.isDestroyed) return;

      setGenerationStatus('generating');

      try {
        const result = await bridge.generateBaseplate(fullParams, (stage, progress) => {
          void stage;
          void progress;
        });

        setGenerationResult({
          vertices: result.mesh.vertices,
          normals: result.mesh.normals,
          indices: result.mesh.indices,
          edgeVertices: result.mesh.edgeVertices,
          error: null,
          timingMs: result.timingMs,
        });
        setGenerationStatus('complete');
      } catch (e: unknown) {
        if (e instanceof Error && e.message === 'Generation cancelled') {
          return;
        }

        setGenerationResult({
          vertices: null,
          normals: null,
          indices: null,
          edgeVertices: null,
          error: e instanceof Error ? e.message : String(e),
          timingMs: 0,
        });
        setGenerationStatus('error');
      }
    },
    [setGenerationStatus, setGenerationResult]
  );

  // Initialize bridge on mount
  useEffect(() => {
    const bridge = new GenerationBridge();
    bridgeRef.current = bridge;
    setActiveBridge(bridge);

    setWasmStatus('loading');

    bridge
      .init()
      .then(() => {
        setWasmStatus('ready');
        initializedRef.current = true;

        const threadingInfo = bridge.getThreadingInfo();
        if (threadingInfo) {
          trackWasmThreadingStatus(threadingInfo.isThreaded, threadingInfo.hardwareConcurrency);
        }

        // Trigger initial generation
        const layoutState = useLayoutStore.getState();
        const stored = layoutState.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
        const params = buildFullParams(
          stored,
          layoutState.layout.drawer.width,
          layoutState.layout.drawer.depth,
          layoutState.layout.gridUnitMm,
          layoutState.layout.drawer.fractionalEdgeX ?? 'end',
          layoutState.layout.drawer.fractionalEdgeY ?? 'end'
        );
        void runGeneration(params);
      })
      .catch((_e: unknown) => {
        setWasmStatus('error');
      });

    return () => {
      bridge.destroy();
      bridgeRef.current = null;
      initializedRef.current = false;
      setActiveBridge(null);
    };
  }, [setWasmStatus, runGeneration]);

  // Re-generate when any param changes
  useEffect(() => {
    if (!initializedRef.current) return;

    const stored = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
    const params = buildFullParams(
      stored,
      drawerWidth,
      drawerDepth,
      gridUnitMm,
      fractionalEdgeX,
      fractionalEdgeY
    );
    void runGeneration(params);
  }, [
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
    magnetHoles,
    magnetDiameter,
    magnetDepth,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack,
    runGeneration,
  ]);
}
