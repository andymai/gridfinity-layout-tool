/**
 * Hook that manages the GenerationBridge lifecycle for the standalone baseplate page.
 *
 * Lifecycle:
 * 1. Mount: Create bridge, init worker, set wasmStatus
 * 2. Layout store changes: Merge drawer dims with baseplateParams, trigger generation
 * 3. Unmount: Destroy bridge
 */

import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { migrateBaseplateParams } from '@/core/constants';
import { GenerationBridge, setActiveBridge } from '@/shared/generation/bridge';
import { trackWasmThreadingStatus } from '@/shared/analytics/posthog';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { buildFullParams } from '../utils/buildFullParams';
import type { BaseplateParams as FullBaseplateParams } from '@/shared/types/bin';

/**
 * Manages the GenerationBridge lifecycle and auto-regeneration
 * when layout params or drawer dimensions change.
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
    baseplateParams,
  } = useLayoutStore(
    useShallow((state) => ({
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      gridUnitMm: state.layout.gridUnitMm,
      fractionalEdgeX: state.layout.drawer.fractionalEdgeX ?? 'end',
      fractionalEdgeY: state.layout.drawer.fractionalEdgeY ?? 'end',
      baseplateParams: migrateBaseplateParams(state.layout.baseplateParams),
    }))
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
        const stored = migrateBaseplateParams(layoutState.layout.baseplateParams);
        const fullParams = buildFullParams(
          stored,
          layoutState.layout.drawer.width,
          layoutState.layout.drawer.depth,
          layoutState.layout.gridUnitMm,
          layoutState.layout.drawer.fractionalEdgeX ?? 'end',
          layoutState.layout.drawer.fractionalEdgeY ?? 'end'
        );
        void runGeneration(fullParams);
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

  // Re-generate when params or drawer dims change
  useEffect(() => {
    if (!initializedRef.current) return;

    const fullParams = buildFullParams(
      baseplateParams,
      drawerWidth,
      drawerDepth,
      gridUnitMm,
      fractionalEdgeX,
      fractionalEdgeY
    );
    void runGeneration(fullParams);
  }, [
    baseplateParams,
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
    runGeneration,
  ]);
}
