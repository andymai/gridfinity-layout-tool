/**
 * Hook that manages the GenerationBridge lifecycle for the standalone baseplate page.
 *
 * Lifecycle:
 * 1. Mount: Create bridge + worker pool, init workers, set wasmStatus
 * 2. Params change: Compute tiling, regenerate BREP (single or multi-piece)
 * 3. Unmount: Destroy bridge + pool
 *
 * When the baseplate exceeds print bed size, it's split into a tiling grid.
 * Pieces are generated in parallel across a worker pool (one WASM instance per worker).
 */

import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { GenerationBridge, setActiveBridge } from '@/shared/generation/bridge';
import { trackWasmThreadingStatus } from '@/shared/analytics/posthog';
import { useToastStore } from '@/core/store/toast';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { buildFullParams } from '../utils/buildFullParams';
import { computeBaseplateTiling, pieceToBaseplateParams } from '../utils/splitPlanner';
import { BaseplateWorkerPool } from './BaseplateWorkerPool';
import type { BaseplateParams as FullBaseplateParams } from '@/shared/types/bin';
import type { PieceMeshEntry } from '../store/baseplatePageStore';

const EMPTY_MESH = {
  vertices: null,
  normals: null,
  indices: null,
  edgeVertices: null,
  error: null,
  timingMs: 0,
} as const;

const NO_OP_PROGRESS = (_stage: string, _progress: number): void => {};

/** Default pool size when hardwareConcurrency is unavailable */
const DEFAULT_POOL_SIZE = 2;

/**
 * Manages the GenerationBridge lifecycle and auto-regeneration
 * when layout params change. Uses a worker pool for parallel split piece generation.
 */
export function useBaseplateGeneration(): void {
  const bridgeRef = useRef<GenerationBridge | null>(null);
  const poolRef = useRef<BaseplateWorkerPool | null>(null);
  const initializedRef = useRef(false);
  const generationEpochRef = useRef(0);

  const {
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    printBedSize,
    fractionalEdgeX,
    fractionalEdgeY,
    magnetHoles,
    magnetDiameter,
    magnetDepth,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack,
    connectorNubs,
  } = useLayoutStore(
    useShallow((state) => {
      const bp = state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      return {
        drawerWidth: state.layout.drawer.width,
        drawerDepth: state.layout.drawer.depth,
        gridUnitMm: state.layout.gridUnitMm,
        printBedSize: state.layout.printBedSize,
        fractionalEdgeX: state.layout.drawer.fractionalEdgeX ?? 'end',
        fractionalEdgeY: state.layout.drawer.fractionalEdgeY ?? 'end',
        magnetHoles: bp.magnetHoles,
        magnetDiameter: bp.magnetDiameter,
        magnetDepth: bp.magnetDepth,
        paddingLeft: bp.paddingLeft,
        paddingRight: bp.paddingRight,
        paddingFront: bp.paddingFront,
        paddingBack: bp.paddingBack,
        connectorNubs: bp.connectorNubs,
      };
    })
  );

  const setGenerationStatus = useBaseplatePageStore((s) => s.setGenerationStatus);
  const setGenerationResult = useBaseplatePageStore((s) => s.setGenerationResult);
  const setWasmStatus = useBaseplatePageStore((s) => s.setWasmStatus);
  const setTiling = useBaseplatePageStore((s) => s.setTiling);
  const setPieceMeshes = useBaseplatePageStore((s) => s.setPieceMeshes);
  const setSplitProgress = useBaseplatePageStore((s) => s.setSplitProgress);

  const runGeneration = useCallback(
    async (fullParams: FullBaseplateParams, bedSizeMm: number) => {
      const bridge = bridgeRef.current;
      if (!bridge || bridge.isDestroyed) return;

      // Increment epoch — any in-flight generation with a stale epoch
      // will discard its results instead of overwriting the new generation.
      const epoch = ++generationEpochRef.current;

      // Compute tiling plan
      const tiling = computeBaseplateTiling(fullParams, bedSizeMm);
      setTiling(tiling);

      setGenerationStatus('generating');

      try {
        if (!tiling.isSplit) {
          // Single piece — use the primary bridge
          const result = await bridge.generateBaseplate(fullParams, NO_OP_PROGRESS);

          // Discard if superseded
          if (generationEpochRef.current !== epoch) return;

          setGenerationResult({
            vertices: result.mesh.vertices,
            normals: result.mesh.normals,
            indices: result.mesh.indices,
            edgeVertices: result.mesh.edgeVertices,
            error: null,
            timingMs: result.timingMs,
          });
          setPieceMeshes([]);
          setGenerationStatus('complete');
        } else {
          // Multi-piece — use worker pool for parallel generation
          const pool = poolRef.current;
          const total = tiling.pieces.length;
          setSplitProgress({ current: 0, total });

          const pieceParamsArray = tiling.pieces.map((piece) =>
            pieceToBaseplateParams(piece, fullParams)
          );

          if (pool && !pool.isDestroyed && pool.size > 1) {
            // Parallel generation via worker pool
            const results = await pool.generatePieces(pieceParamsArray);

            // Discard if superseded
            if (generationEpochRef.current !== epoch) return;

            const meshEntries: PieceMeshEntry[] = results.map((result, i) => {
              const piece = tiling.pieces[i];
              return {
                label: piece.label,
                col: piece.col,
                row: piece.row,
                mesh: {
                  vertices: result.mesh.vertices,
                  normals: result.mesh.normals,
                  indices: result.mesh.indices,
                  edgeVertices: result.mesh.edgeVertices,
                  error: null,
                  timingMs: result.timingMs,
                },
                offsetX: piece.gridOffsetX,
                offsetY: piece.gridOffsetY,
                widthUnits: piece.widthUnits,
                depthUnits: piece.depthUnits,
              };
            });

            setSplitProgress(null);
            setPieceMeshes(meshEntries);
            setGenerationResult(EMPTY_MESH);
            setGenerationStatus('complete');
          } else {
            // Fallback: sequential generation via primary bridge
            const meshEntries: PieceMeshEntry[] = [];

            for (let i = 0; i < tiling.pieces.length; i++) {
              const piece = tiling.pieces[i];
              setSplitProgress({ current: i + 1, total });
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- re-check between async iterations
              if (bridge.isDestroyed || generationEpochRef.current !== epoch) return;

              const result = await bridge.generateBaseplate(pieceParamsArray[i], NO_OP_PROGRESS);

              // Discard if a newer generation started while awaiting
              if (generationEpochRef.current !== epoch) return;

              meshEntries.push({
                label: piece.label,
                col: piece.col,
                row: piece.row,
                mesh: {
                  vertices: result.mesh.vertices,
                  normals: result.mesh.normals,
                  indices: result.mesh.indices,
                  edgeVertices: result.mesh.edgeVertices,
                  error: null,
                  timingMs: result.timingMs,
                },
                offsetX: piece.gridOffsetX,
                offsetY: piece.gridOffsetY,
                widthUnits: piece.widthUnits,
                depthUnits: piece.depthUnits,
              });
            }

            setSplitProgress(null);
            setPieceMeshes(meshEntries);
            setGenerationResult(EMPTY_MESH);
            setGenerationStatus('complete');
          }
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.message === 'Generation cancelled') {
          return;
        }
        if (e instanceof DOMException && e.name === 'AbortError') {
          return;
        }

        // Only update error state if this is still the active generation
        if (generationEpochRef.current !== epoch) return;

        setSplitProgress(null);
        setGenerationResult({
          ...EMPTY_MESH,
          error: e instanceof Error ? e.message : String(e),
        });
        setPieceMeshes([]);
        setGenerationStatus('error');
      }
    },
    [setGenerationStatus, setGenerationResult, setTiling, setPieceMeshes, setSplitProgress]
  );

  // Initialize bridge + worker pool on mount
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

        // Initialize worker pool in the background (don't block initial generation)
        const poolSize = threadingInfo?.hardwareConcurrency
          ? Math.min(threadingInfo.hardwareConcurrency, 4)
          : DEFAULT_POOL_SIZE;
        if (poolSize > 1) {
          const pool = new BaseplateWorkerPool();
          poolRef.current = pool;
          void pool.init(poolSize).catch(() => {
            // Pool init failure is non-fatal — falls back to sequential generation
            pool.destroy();
            poolRef.current = null;
          });
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
        void runGeneration(params, layoutState.layout.printBedSize);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        useToastStore.getState().addToast(`Failed to initialize 3D engine: ${message}`, 'error');
        setWasmStatus('error');
      });

    return () => {
      bridge.destroy();
      bridgeRef.current = null;
      initializedRef.current = false;
      setActiveBridge(null);

      // Destroy worker pool
      poolRef.current?.destroy();
      poolRef.current = null;
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
    void runGeneration(params, printBedSize);
  }, [
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    printBedSize,
    fractionalEdgeX,
    fractionalEdgeY,
    magnetHoles,
    magnetDiameter,
    magnetDepth,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack,
    connectorNubs,
    runGeneration,
  ]);
}
