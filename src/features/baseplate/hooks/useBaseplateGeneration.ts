/**
 * Hook that manages the GenerationBridge lifecycle for the standalone baseplate page.
 *
 * Two-phase generation:
 *
 *   1. Direct-mesh preview — synchronous procedural generation that runs on
 *      every params change, before WASM is even loaded. Produces a visually
 *      equivalent placeholder mesh in <100 ms (versus 2-8 s for BREP cold-start).
 *      The user sees something orbitable immediately.
 *
 *   2. BREP generation — runs in the background once the WASM bridge is ready.
 *      The high-fidelity result silently replaces the direct-mesh once it lands.
 *      For split tilings, BREP pieces are generated in parallel via the worker
 *      pool and replace direct-mesh tiles one-by-one as they complete.
 *
 * Lifecycle:
 *   1. Mount: kick off direct-mesh immediately + acquire bridge in background
 *   2. Params change: direct-mesh syncs immediately; BREP regen if bridge ready
 *   3. Bridge becomes ready: BREP regen for current params
 *   4. Unmount: release bridge + pool references
 *
 * Epoch counter discards stale results when params change mid-flight.
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
  trackBaseplatePreviewTiming,
} from '@/shared/analytics/posthog';
import { useToastStore } from '@/core/store/toast';
import { getStaticTranslation } from '@/i18n';
import { generateBaseplateDirect } from '@/shared/generation/directMesh';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { buildFullParams } from '../utils/buildFullParams';
import { computeBaseplateTiling } from '../utils/splitPlanner';
import { groupPiecesByFingerprint } from '../utils/pieceFingerprint';
import type { BaseplateParams as FullBaseplateParams } from '@/shared/types/bin';
import type { PieceMeshEntry } from '../store/baseplatePageStore';
import type { GenerationResult, MeshData } from '@/shared/generation/bridge';
import type { BaseplateTiling } from '../types/tiling';

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
  },
  source: 'direct' | 'brep'
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
      source,
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

/** Wrap a MeshData in a GenerationResult shape so the same builders work for both paths. */
function wrapMeshAsResult(mesh: MeshData, timingMs: number): GenerationResult {
  return { mesh, timingMs };
}

/**
 * True when there is a visible mesh on the canvas (single OR any split piece).
 *
 * Drives the "graceful BREP failure" branch: if a preview is on screen we keep
 * it visible and surface the BREP error as a toast instead of replacing the
 * canvas with a red error overlay.
 *
 * The null-check expansion is deliberate: an earlier version used
 * `mesh?.vertices !== null`, which short-circuits to `undefined !== null` (i.e.
 * `true`) when `mesh` itself is `null` — wrongly reporting a preview on a
 * blank canvas. Exported for regression test.
 */
export function hasMeshOnScreen(state: {
  pieceMeshes: { length: number };
  generation: { mesh: { vertices: Float32Array | null } | null };
}): boolean {
  if (state.pieceMeshes.length > 0) return true;
  const mesh = state.generation.mesh;
  return mesh !== null && mesh.vertices !== null;
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
  /**
   * Flips to true after the first BREP run completes (success or failure).
   * Used to label the very first BREP as a cold-WASM start in analytics —
   * `initializedRef` would always be `true` here because the bridge sets
   * it before kicking off that first BREP.
   */
  const firstBrepDoneRef = useRef(false);
  const generationEpochRef = useRef(0);
  /** Time the most recent direct-mesh phase started — used to compute BREP elapsed for analytics. */
  const directMeshStartRef = useRef<number>(0);
  const directMeshDurationRef = useRef<number>(0);

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
    invertDovetails,
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
        invertDovetails: bp.invertDovetails,
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

  /**
   * Phase 1: Synchronous direct-mesh preview.
   *
   * Runs on every params change before BREP. Pure procedural generation —
   * no worker, no WASM, no awaits. Populates store immediately so the
   * canvas renders something orbitable while BREP catches up.
   *
   * Returns the tiling so the caller (BREP phase) can reuse it.
   */
  const runDirectMeshPreview = useCallback(
    (
      fullParams: FullBaseplateParams,
      bedWidthMm: number,
      bedDepthMm: number,
      epoch: number
    ): BaseplateTiling => {
      directMeshStartRef.current = performance.now();

      const tiling = computeBaseplateTiling(fullParams, bedWidthMm, bedDepthMm);
      setTiling(tiling);
      setSplitProgress(null);
      setDedupStats(null);

      try {
        if (!tiling.isSplit) {
          const mesh = generateBaseplateDirect(fullParams, NO_OP_PROGRESS);
          if (generationEpochRef.current !== epoch) return tiling;

          setGenerationResult({
            vertices: mesh.vertices,
            normals: mesh.normals,
            indices: mesh.indices,
            edgeVertices: mesh.edgeVertices,
            error: null,
            timingMs: performance.now() - directMeshStartRef.current,
            source: 'direct',
          });
          setPieceMeshes([]);
        } else {
          // Split: generate one direct-mesh per unique piece group, clone for duplicates.
          const groups = groupPiecesByFingerprint(tiling.pieces, fullParams);
          // `new Array(n)` returns `any[]`; we pre-size the typed slot.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const meshEntries: PieceMeshEntry[] = new Array(tiling.pieces.length);

          for (const group of groups.values()) {
            const baseMesh = generateBaseplateDirect(group.params, NO_OP_PROGRESS);
            const baseResult = wrapMeshAsResult(baseMesh, 0);

            for (let j = 0; j < group.indices.length; j++) {
              const pieceIdx = group.indices[j];
              const piece = tiling.pieces[pieceIdx];
              const result = j === 0 ? baseResult : cloneGenerationResult(baseResult);
              meshEntries[pieceIdx] = buildPieceMeshEntry(result, piece, 'direct');
            }
          }

          if (generationEpochRef.current !== epoch) return tiling;

          setPieceMeshes(meshEntries);
          setGenerationResult(EMPTY_MESH);
        }
      } catch {
        // Direct-mesh failed — extremely rare (only on invalid params that
        // would also fail BREP). Leave existing mesh in place; let BREP
        // either succeed (overwriting it) or surface the real error.
      } finally {
        // Stamp the duration on every exit (success, early epoch return, or
        // throw) so the BREP timing event always reads a fresh value. Today
        // `generateBaseplateDirect` is synchronous and the epoch checks are
        // unreachable, but moving this out of the success-only path hardens
        // it against any future async refactor of the direct-mesh generator.
        directMeshDurationRef.current = performance.now() - directMeshStartRef.current;
      }

      return tiling;
    },
    [setTiling, setGenerationResult, setPieceMeshes, setSplitProgress, setDedupStats]
  );

  /**
   * Phase 2: BREP generation via WASM bridge. Replaces direct-mesh on success.
   *
   * Uses the precomputed tiling from the direct-mesh phase. For splits, runs
   * pieces in parallel via the worker pool and overwrites pieceMeshes per group
   * as results land — so the user sees pieces "upgrade" from direct to BREP one
   * at a time. On failure with a direct-mesh preview already on screen, surfaces
   * a non-blocking retry message instead of replacing the preview.
   */
  const runBrepGeneration = useCallback(
    async (fullParams: FullBaseplateParams, tiling: BaseplateTiling, epoch: number) => {
      const bridge = bridgeRef.current;
      if (!bridge || bridge.isDestroyed) return;

      const brepStart = performance.now();
      // Cold = first BREP this session. Captured here (not via initializedRef)
      // because the mount handler sets initializedRef BEFORE kicking off this
      // very first BREP, so reading initializedRef would always say "warm".
      const wasmCold = !firstBrepDoneRef.current;
      // `shouldTrack` stays false for cancellation/unmount paths so PostHog
      // isn't polluted by `success:false` events that aren't real failures.
      let shouldTrack = false;
      let succeeded = false;
      setGenerationStatus('generating');

      try {
        if (!tiling.isSplit) {
          const result = await bridge.generateBaseplate(fullParams, NO_OP_PROGRESS);
          if (generationEpochRef.current !== epoch) return;

          setGenerationResult({
            vertices: result.mesh.vertices,
            normals: result.mesh.normals,
            indices: result.mesh.indices,
            edgeVertices: result.mesh.edgeVertices,
            error: null,
            timingMs: result.timingMs,
            source: 'brep',
          });
          setPieceMeshes([]);
          setGenerationStatus('complete');
        } else {
          const pool = poolRef.current;
          const groups = groupPiecesByFingerprint(tiling.pieces, fullParams);
          const uniqueGroups = [...groups.values()];
          const uniqueCount = uniqueGroups.length;
          const totalCount = tiling.pieces.length;
          const duplicatesSkipped = totalCount - uniqueCount;

          setDedupStats({ uniqueCount, totalCount, duplicatesSkipped });
          setSplitProgress({ current: 0, total: uniqueCount });

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

          // Build mesh entries: original for first piece in group, clone for duplicates.
          // `new Array(n)` returns `any[]`; we pre-size the typed slot.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const meshEntries: PieceMeshEntry[] = new Array(totalCount);
          for (let groupIdx = 0; groupIdx < uniqueGroups.length; groupIdx++) {
            const group = uniqueGroups[groupIdx];
            const result = uniqueResults[groupIdx];

            for (let j = 0; j < group.indices.length; j++) {
              const pieceIdx = group.indices[j];
              const piece = tiling.pieces[pieceIdx];
              const pieceResult = j === 0 ? result : cloneGenerationResult(result);
              meshEntries[pieceIdx] = buildPieceMeshEntry(pieceResult, piece, 'brep');
            }
          }

          setSplitProgress(null);
          setPieceMeshes(meshEntries);
          setGenerationResult(EMPTY_MESH);
          setGenerationStatus('complete');
        }
        shouldTrack = true;
        succeeded = true;
      } catch (e: unknown) {
        // These three early returns are intentional non-events: bridge
        // cancellation (e.g. unmount) and superseded epochs aren't user-
        // visible failures, so they don't get tracked or counted as a
        // real BREP completion.
        if (e instanceof Error && e.message === 'Generation cancelled') return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        if (generationEpochRef.current !== epoch) return;

        const message = e instanceof Error ? e.message : String(e);
        const previewVisible = hasMeshOnScreen(useBaseplatePageStore.getState());

        setSplitProgress(null);
        // Always clear dedup stats on BREP exit. They're only read by the
        // status pill (which hides on 'complete'/'error'), so it's harmless
        // today, but leaving stale split-piece counts in the store would
        // surface as a phantom dedup pill the next time some unrelated code
        // happened to flip generationStatus back to 'generating'.
        setDedupStats(null);

        if (previewVisible) {
          // Preview is already usable — keep it visible, surface a non-blocking
          // toast instead of replacing the canvas with a red error overlay.
          setGenerationStatus('complete');
          useToastStore
            .getState()
            .addToast(getStaticTranslation('baseplate.brepFinalizeFailed'), 'error');
        } else {
          setGenerationResult({
            ...EMPTY_MESH,
            error: message,
          });
          setPieceMeshes([]);
          setGenerationStatus('error');
        }
        shouldTrack = true;
      } finally {
        if (shouldTrack) {
          firstBrepDoneRef.current = true;
          trackBaseplatePreviewTiming({
            directMeshMs: directMeshDurationRef.current,
            brepMs: performance.now() - brepStart,
            pieceCount: tiling.pieces.length,
            isSplit: tiling.isSplit,
            wasmCold,
            success: succeeded,
          });
        }
      }
    },
    [setGenerationStatus, setGenerationResult, setPieceMeshes, setSplitProgress, setDedupStats]
  );

  /**
   * Combined flow: direct-mesh always runs; BREP only if bridge is ready.
   * If the bridge isn't ready yet, the direct-mesh preview stays on screen
   * and BREP kicks in once `bridgeManager.acquire()` resolves (mount effect).
   */
  const runGeneration = useCallback(
    (fullParams: FullBaseplateParams, bedWidthMm: number, bedDepthMm: number) => {
      const epoch = ++generationEpochRef.current;
      // Flip to 'generating' before BREP starts so the bottom pill is visible
      // during the direct-mesh-only window (when the bridge isn't ready yet).
      // Without this, the pill is hidden for the whole 4-8 s WASM-load period
      // even though the user can see the direct-mesh preview.
      setGenerationStatus('generating');
      const tiling = runDirectMeshPreview(fullParams, bedWidthMm, bedDepthMm, epoch);
      void runBrepGeneration(fullParams, tiling, epoch);
    },
    [setGenerationStatus, runDirectMeshPreview, runBrepGeneration]
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

        // Bridge is ready — kick off BREP for the current params. Direct-mesh
        // has already populated the canvas via the params-change effect.
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
        const bedW = layoutState.layout.printBedSize;
        const bedD = layoutState.layout.printBedDepth ?? layoutState.layout.printBedSize;
        const epoch = ++generationEpochRef.current;
        const tiling = computeBaseplateTiling(params, bedW, bedD);
        void runBrepGeneration(params, tiling, epoch);
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
  }, [setWasmStatus, runBrepGeneration]);

  // Re-generate on every params change. Direct-mesh runs synchronously here
  // (renders before bridge is ready); BREP runs in background once bridge exists.
  useEffect(() => {
    const stored = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
    const params = buildFullParams(
      stored,
      drawerWidth,
      drawerDepth,
      gridUnitMm,
      fractionalEdgeX,
      fractionalEdgeY
    );
    runGeneration(params, printBedSize, printBedDepth ?? printBedSize);
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
    invertDovetails,
    runGeneration,
  ]);
}
