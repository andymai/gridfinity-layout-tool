/**
 * Hook that manages the GenerationBridge lifecycle for the standalone baseplate page.
 *
 * Lifecycle:
 * 1. Mount: Acquire bridge + worker pool via shared managers
 * 2. Params change: Compute tiling, regenerate BREP (single or multi-piece)
 * 3. Unmount: Release bridge + pool references
 *
 * When the baseplate exceeds print bed size, it's split into a tiling grid.
 * Pieces are generated in parallel across the shared worker pool.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { bridgeManager, workerPoolManager } from '@/shared/generation/bridge';
import type { GenerationBridge } from '@/shared/generation/bridge';
import type { WorkerPool } from '@/shared/generation/bridge';
import {
  trackWasmThreadingStatus,
  trackCachePerformance,
  trackKernelPerformance,
} from '@/shared/analytics/posthog';
import { useToastStore } from '@/core/store/toast';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { buildFullParams } from '../utils/buildFullParams';
import { computeBaseplateTiling } from '../utils/splitPlanner';
import { groupPiecesByFingerprint } from '../utils/pieceFingerprint';
import type { BaseplateParams as FullBaseplateParams } from '@/shared/types/bin';
import type { PieceMeshEntry } from '../store/baseplatePageStore';
import type { GenerationResult } from '@/shared/generation/bridge';

/** Build a PieceMeshEntry from a generation result and tiling piece metadata */
function buildPieceMeshEntry(
  result: GenerationResult,
  piece: {
    label: string;
    col: number;
    row: number;
    gridOffsetX: number;
    gridOffsetY: number;
    widthUnits: number;
    depthUnits: number;
  }
): PieceMeshEntry {
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
}

const EMPTY_MESH = {
  vertices: null,
  normals: null,
  indices: null,
  edgeVertices: null,
  error: null,
  timingMs: 0,
} as const;

/** Clone mesh buffers so each piece gets independent typed arrays for Three.js. */
function cloneGenerationResult(result: GenerationResult): GenerationResult {
  return {
    mesh: {
      ...result.mesh,
      vertices: result.mesh.vertices.slice(),
      normals: result.mesh.normals.slice(),
      indices: result.mesh.indices.slice(),
      edgeVertices: result.mesh.edgeVertices.slice(),
    },
    timingMs: 0,
  };
}

const NO_OP_PROGRESS = (_stage: string, _progress: number): void => {};

/**
 * Manages the GenerationBridge lifecycle and auto-regeneration
 * when layout params change. Uses the shared worker pool for parallel split piece generation.
 */
export function useBaseplateGeneration(): void {
  const bridgeRef = useRef<GenerationBridge | null>(null);
  const poolRef = useRef<WorkerPool | null>(null);
  const initializedRef = useRef(false);
  const generationEpochRef = useRef(0);

  const {
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    printBedSize,
    printBedDepth,
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
    syncWithLayout,
    baseplateWidth,
    baseplateDepth,
    cornerRadius,
    cornerRadii,
  } = useLayoutStore(
    useShallow((state) => {
      const bp = state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      return {
        drawerWidth: state.layout.drawer.width,
        drawerDepth: state.layout.drawer.depth,
        gridUnitMm: state.layout.gridUnitMm,
        printBedSize: state.layout.printBedSize,
        printBedDepth: state.layout.printBedDepth,
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
        syncWithLayout: bp.syncWithLayout,
        baseplateWidth: bp.baseplateWidth,
        baseplateDepth: bp.baseplateDepth,
        cornerRadius: bp.cornerRadius,
        cornerRadii: bp.cornerRadii,
      };
    })
  );

  const setGenerationStatus = useBaseplatePageStore((s) => s.setGenerationStatus);
  const setGenerationResult = useBaseplatePageStore((s) => s.setGenerationResult);
  const setWasmStatus = useBaseplatePageStore((s) => s.setWasmStatus);
  const setTiling = useBaseplatePageStore((s) => s.setTiling);
  const setPieceMeshes = useBaseplatePageStore((s) => s.setPieceMeshes);
  const setSplitProgress = useBaseplatePageStore((s) => s.setSplitProgress);
  const setDedupStats = useBaseplatePageStore((s) => s.setDedupStats);

  const runGeneration = useCallback(
    async (fullParams: FullBaseplateParams, bedWidthMm: number, bedDepthMm: number) => {
      const bridge = bridgeRef.current;
      if (!bridge || bridge.isDestroyed) return;

      // Increment epoch — any in-flight generation with a stale epoch
      // will discard its results instead of overwriting the new generation.
      const epoch = ++generationEpochRef.current;

      // Compute tiling plan
      const tiling = computeBaseplateTiling(fullParams, bedWidthMm, bedDepthMm);
      setTiling(tiling);

      setGenerationStatus('generating');
      setDedupStats(null);

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
          // Multi-piece — deduplicate then generate unique shapes only
          const pool = poolRef.current;
          const groups = groupPiecesByFingerprint(tiling.pieces, fullParams);
          const uniqueGroups = [...groups.values()];
          const uniqueCount = uniqueGroups.length;
          const totalCount = tiling.pieces.length;
          const duplicatesSkipped = totalCount - uniqueCount;

          setDedupStats({ uniqueCount, totalCount, duplicatesSkipped });
          setSplitProgress({ current: 0, total: uniqueCount });

          // Generate only unique shapes
          const uniqueParams = uniqueGroups.map((g) => g.params);
          let uniqueResults: GenerationResult[];

          if (pool && !pool.isDestroyed && pool.size > 1) {
            uniqueResults = await pool.generateBaseplates(uniqueParams, (completed, pieceTotal) =>
              setSplitProgress({ current: completed, total: pieceTotal })
            );

            if (generationEpochRef.current !== epoch) return;
          } else {
            uniqueResults = [];

            for (let i = 0; i < uniqueParams.length; i++) {
              setSplitProgress({ current: i + 1, total: uniqueCount });
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- re-check between async iterations
              if (bridge.isDestroyed || generationEpochRef.current !== epoch) return;

              const result = await bridge.generateBaseplate(uniqueParams[i], NO_OP_PROGRESS);

              if (generationEpochRef.current !== epoch) return;

              uniqueResults.push(result);
            }
          }

          // Build mesh entries: original for first piece in group, clone for duplicates
          const meshEntries: PieceMeshEntry[] = new Array(totalCount);

          for (let groupIdx = 0; groupIdx < uniqueGroups.length; groupIdx++) {
            const group = uniqueGroups[groupIdx];
            const result = uniqueResults[groupIdx];

            for (let j = 0; j < group.indices.length; j++) {
              const pieceIdx = group.indices[j];
              const piece = tiling.pieces[pieceIdx];

              if (j === 0) {
                meshEntries[pieceIdx] = buildPieceMeshEntry(result, piece);
              } else {
                meshEntries[pieceIdx] = buildPieceMeshEntry(cloneGenerationResult(result), piece);
              }
            }
          }

          setSplitProgress(null);
          setPieceMeshes(meshEntries);
          setGenerationResult(EMPTY_MESH);
          setGenerationStatus('complete');
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
        setDedupStats(null);
        setGenerationResult({
          ...EMPTY_MESH,
          error: e instanceof Error ? e.message : String(e),
        });
        setPieceMeshes([]);
        setGenerationStatus('error');
      }
    },
    [
      setGenerationStatus,
      setGenerationResult,
      setTiling,
      setPieceMeshes,
      setSplitProgress,
      setDedupStats,
    ]
  );

  // Initialize bridge via BridgeManager + worker pool on mount
  useEffect(() => {
    let cancelled = false;

    setWasmStatus('loading');

    bridgeManager
      .acquire()
      .then((bridge) => {
        if (cancelled) {
          bridgeManager.release();
          return;
        }
        bridgeRef.current = bridge;
        setWasmStatus('ready');
        initializedRef.current = true;

        const threadingInfo = bridge.getThreadingInfo();
        if (threadingInfo) {
          trackWasmThreadingStatus(threadingInfo.isThreaded, threadingInfo.hardwareConcurrency);
        }

        // Wire up cache stats and kernel perf reporting to PostHog
        bridge.onCacheStats = trackCachePerformance;
        bridge.onKernelPerfStats = trackKernelPerformance;

        // Acquire shared worker pool in the background (don't block initial generation)
        void workerPoolManager
          .acquire()
          .then((pool) => {
            if (cancelled) {
              workerPoolManager.release();
              return;
            }
            poolRef.current = pool;
          })
          .catch(() => {
            // Non-fatal — falls back to sequential generation
          });

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
        void runGeneration(
          params,
          layoutState.layout.printBedSize,
          layoutState.layout.printBedDepth ?? layoutState.layout.printBedSize
        );
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        useToastStore.getState().addToast(`Failed to initialize 3D engine: ${message}`, 'error');
        setWasmStatus('error');
      });

    return () => {
      cancelled = true;
      bridgeRef.current = null;
      initializedRef.current = false;
      bridgeManager.release();

      if (poolRef.current) {
        poolRef.current = null;
        workerPoolManager.release();
      }
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
    void runGeneration(params, printBedSize, printBedDepth ?? printBedSize);
  }, [
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    printBedSize,
    printBedDepth,
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
    syncWithLayout,
    baseplateWidth,
    baseplateDepth,
    cornerRadius,
    cornerRadii,
    runGeneration,
  ]);
}
