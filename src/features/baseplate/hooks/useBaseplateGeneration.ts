/**
 * Hook that manages the GenerationBridge lifecycle for the standalone baseplate page.
 *
 * Performance optimization: padding distribution changes do NOT trigger BREP regeneration.
 * The BREP solid is always generated with centered padding (equal on both sides), since
 * only the total padding per axis affects the slab geometry. The actual asymmetric offset
 * is applied in Three.js via slabOffset stored in baseplatePageStore.
 *
 * Lifecycle:
 * 1. Mount: Create bridge, init worker, set wasmStatus
 * 2. Geometry params change: Regenerate BREP (grid dims, total padding, magnets)
 * 3. Distribution changes: Update slabOffset only (no BREP work)
 * 4. Unmount: Destroy bridge
 */

import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { GenerationBridge, setActiveBridge } from '@/shared/generation/bridge';
import { trackWasmThreadingStatus } from '@/shared/analytics/posthog';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { buildCenteredParams } from '../utils/buildFullParams';
import type { BaseplateParams as FullBaseplateParams } from '@/shared/types/bin';

/**
 * Manages the GenerationBridge lifecycle and auto-regeneration
 * when layout params or padding totals change.
 */
export function useBaseplateGeneration(): void {
  const bridgeRef = useRef<GenerationBridge | null>(null);
  const initializedRef = useRef(false);

  // Geometry-affecting params (trigger BREP regeneration)
  const {
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
    magnetHoles,
    magnetDiameter,
    magnetDepth,
    totalPaddingX,
    totalPaddingY,
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
        totalPaddingX: bp.paddingLeft + bp.paddingRight,
        totalPaddingY: bp.paddingFront + bp.paddingBack,
      };
    })
  );

  // Distribution params (only affect slab offset, no BREP regeneration)
  const { paddingLeft, paddingRight, paddingFront, paddingBack } = useLayoutStore(
    useShallow((state) => {
      const bp = state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      return {
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
  const setSlabOffset = useBaseplatePageStore((s) => s.setSlabOffset);

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

        // Trigger initial generation with centered params
        const layoutState = useLayoutStore.getState();
        const stored = layoutState.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
        const { params, slabOffsetX, slabOffsetY } = buildCenteredParams(
          stored,
          layoutState.layout.drawer.width,
          layoutState.layout.drawer.depth,
          layoutState.layout.gridUnitMm,
          layoutState.layout.drawer.fractionalEdgeX ?? 'end',
          layoutState.layout.drawer.fractionalEdgeY ?? 'end'
        );
        setSlabOffset(slabOffsetX, slabOffsetY);
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
  }, [setWasmStatus, setSlabOffset, runGeneration]);

  // Re-generate when geometry-affecting params change (NOT distribution)
  useEffect(() => {
    if (!initializedRef.current) return;

    const stored = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
    const { params, slabOffsetX, slabOffsetY } = buildCenteredParams(
      stored,
      drawerWidth,
      drawerDepth,
      gridUnitMm,
      fractionalEdgeX,
      fractionalEdgeY
    );
    setSlabOffset(slabOffsetX, slabOffsetY);
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
    totalPaddingX,
    totalPaddingY,
    runGeneration,
    setSlabOffset,
  ]);

  // Update slab offset instantly when distribution changes (no BREP regeneration)
  useEffect(() => {
    setSlabOffset((paddingLeft - paddingRight) / 2, (paddingFront - paddingBack) / 2);
  }, [paddingLeft, paddingRight, paddingFront, paddingBack, setSlabOffset]);
}
