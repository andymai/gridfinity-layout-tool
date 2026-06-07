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
import { useTranslation } from '@/i18n';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { bridgeManager, workerPoolManager, createDraftSkipGate } from '@/shared/generation/bridge';
import type { GenerationBridge } from '@/shared/generation/bridge';
import type { WorkerPool } from '@/shared/generation/bridge';
import { handleWasmLoadFailure } from '@/shared/generation/captureWasmLoadFailure';
import {
  trackWasmThreadingStatus,
  trackCachePerformance,
  trackKernelPerformance,
  trackBooleanFallbacks,
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
import type { GenerationResult } from '@/shared/generation/bridge';
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
    placementRotationDeg: 0 | 180;
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
    placementRotationDeg: piece.placementRotationDeg,
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

/**
 * Fill one group's slots in the pre-sized piece-mesh array: the first piece
 * keeps the original result, duplicates get cloned typed arrays so Three.js
 * never shares buffers across pieces.
 */
function fillGroupMeshEntries(
  meshEntries: PieceMeshEntry[],
  group: { indices: readonly number[] },
  pieces: BaseplateTiling['pieces'],
  result: GenerationResult,
  source: 'direct' | 'brep'
): void {
  group.indices.forEach((pieceIdx, j) => {
    const pieceResult = j === 0 ? result : cloneGenerationResult(result);
    meshEntries[pieceIdx] = buildPieceMeshEntry(pieceResult, pieces[pieceIdx], source);
  });
}

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

/** Single-mesh store payload for the unsplit baseplate (draft and BREP share this shape). */
function toSingleMesh(result: GenerationResult, source: 'direct' | 'brep') {
  return {
    vertices: result.mesh.vertices,
    normals: result.mesh.normals,
    indices: result.mesh.indices,
    edgeVertices: result.mesh.edgeVertices,
    error: null,
    timingMs: result.timingMs,
    source,
  };
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

type LayoutStoreState = ReturnType<typeof useLayoutStore.getState>;

/**
 * The layout fields whose change must trigger a baseplate regeneration. Used as
 * the single source of truth for BOTH the `useShallow` selection and the regen
 * effect's dependency — they previously duplicated this list, and a geometry
 * param (`connectorStyle`) dropped from one half silently stopped regeneration
 * (the exploded preview kept its stale dovetail pieces). Keeping it in one place
 * means a new geometry param is wired in by adding it here once.
 */
export function selectGenerationTriggers(state: LayoutStoreState) {
  const bp = state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
  return {
    drawerWidth: state.layout.drawer.width,
    drawerDepth: state.layout.drawer.depth,
    gridUnitMm: state.layout.gridUnitMm,
    printBedSize: state.layout.printBedSize,
    printBedDepth: state.layout.printBedDepth,
    fractionalEdgeX: state.layout.drawer.fractionalEdgeX ?? 'end',
    fractionalEdgeY: state.layout.drawer.fractionalEdgeY ?? 'end',
    overTile: bp.overTile ?? false,
    magnetHoles: bp.magnetHoles,
    magnetDiameter: bp.magnetDiameter,
    magnetDepth: bp.magnetDepth,
    paddingLeft: bp.paddingLeft,
    paddingRight: bp.paddingRight,
    paddingFront: bp.paddingFront,
    paddingBack: bp.paddingBack,
    connectorNubs: bp.connectorNubs,
    connectorStyle: bp.connectorStyle,
    syncWithLayout: bp.syncWithLayout,
    baseplateWidth: bp.baseplateWidth,
    baseplateDepth: bp.baseplateDepth,
    cornerRadius: bp.cornerRadius,
    cornerRadii: bp.cornerRadii,
    invertDovetails: bp.invertDovetails,
    preferIdenticalPieces: bp.preferIdenticalPieces,
  };
}

/**
 * Manages the GenerationBridge lifecycle and auto-regeneration
 * when layout params change. Uses the shared worker pool for parallel split piece generation.
 */
export function useBaseplateGeneration(): void {
  const t = useTranslation();
  const bridgeRef = useRef<GenerationBridge | null>(null);
  const previewBridgeRef = useRef<GenerationBridge | null>(null);
  const poolRef = useRef<WorkerPool | null>(null);
  const initializedRef = useRef(false);
  /**
   * Highest epoch whose exact (BREP) result has been applied. The Manifold
   * draft is async, so it can resolve after the BREP it races; dropping drafts
   * at or below this epoch keeps a late draft from overwriting a fresh exact.
   */
  const finalizedEpochRef = useRef(0);
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
  /**
   * Which path produced the first on-screen frame — `'manifold'` (draft kernel,
   * a WASM round-trip) vs `'direct'` (synchronous procedural) — set alongside
   * `directMeshDurationRef` so `baseplate_preview_timing` can split the two.
   */
  const previewKindRef = useRef<'direct' | 'manifold'>('direct');
  /** Last successful BREP wall-clock — predicts whether a draft is worth showing. */
  const lastBrepMsRef = useRef<number | null>(null);
  const draftSkipGate = useRef(createDraftSkipGate()).current;

  // Single memoized selection drives both the values used below and the regen
  // effect's dependency (see `selectGenerationTriggers`). `useShallow` keeps the
  // object reference stable until any tracked field changes, so depending on the
  // whole object is equivalent to listing every field — without the duplication
  // that previously let `connectorStyle` fall out of the trigger set.
  const generationTriggers = useLayoutStore(useShallow(selectGenerationTriggers));
  const {
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    printBedSize,
    printBedDepth,
    fractionalEdgeX,
    fractionalEdgeY,
  } = generationTriggers;

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

          const timingMs = performance.now() - directMeshStartRef.current;
          setGenerationResult(toSingleMesh({ mesh, timingMs }, 'direct'));
          setPieceMeshes([]);
        } else {
          // Split: generate one direct-mesh per unique piece group, clone for duplicates.
          const groups = groupPiecesByFingerprint(tiling.pieces, fullParams);
          // `new Array(n)` returns `any[]`; we pre-size the typed slot.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const meshEntries: PieceMeshEntry[] = new Array(tiling.pieces.length);

          for (const group of groups.values()) {
            const mesh = generateBaseplateDirect(group.params, NO_OP_PROGRESS);
            const result = { mesh, timingMs: 0 };
            fillGroupMeshEntries(meshEntries, group, tiling.pieces, result, 'direct');
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
        previewKindRef.current = 'direct';
      }

      return tiling;
    },
    [setTiling, setGenerationResult, setPieceMeshes, setSplitProgress, setDedupStats]
  );

  /**
   * Phase 1 (Manifold preview variant): a fast draft that runs the real
   * `generateBaseplate` on the Manifold kernel at draft quality when the
   * `manifold_preview` flag is on. More faithful than the procedural direct-mesh
   * (same code path as the exact BREP) at the cost of a WASM round-trip. Returns
   * `false` when no preview bridge is available or the draft throws, so the
   * caller can fall back to direct-mesh.
   *
   * The exact BREP always supersedes: drafts at or below `finalizedEpochRef`
   * are dropped (the draft is async and may resolve after the BREP it races).
   */
  const runManifoldDraftPreview = useCallback(
    async (
      fullParams: FullBaseplateParams,
      tiling: BaseplateTiling,
      epoch: number
    ): Promise<boolean> => {
      const preview = previewBridgeRef.current;
      if (!preview || preview.isDestroyed) return false;

      const start = performance.now();
      const stillCurrent = () =>
        generationEpochRef.current === epoch && epoch > finalizedEpochRef.current;

      try {
        if (!tiling.isSplit) {
          const result = await preview.generateBaseplate(fullParams, NO_OP_PROGRESS);
          if (!stillCurrent()) return true;
          setGenerationResult(toSingleMesh(result, 'direct'));
          setPieceMeshes([]);
        } else {
          const groups = groupPiecesByFingerprint(tiling.pieces, fullParams);
          // `new Array(n)` returns `any[]`; we pre-size the typed slot.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const meshEntries: PieceMeshEntry[] = new Array(tiling.pieces.length);

          for (const group of groups.values()) {
            const baseResult = await preview.generateBaseplate(group.params, NO_OP_PROGRESS);
            if (!stillCurrent()) return true;
            fillGroupMeshEntries(meshEntries, group, tiling.pieces, baseResult, 'direct');
          }

          if (!stillCurrent()) return true;
          setPieceMeshes(meshEntries);
          setGenerationResult(EMPTY_MESH);
        }
      } catch {
        return false; // draft failed — caller falls back to the procedural direct-mesh
      } finally {
        directMeshDurationRef.current = performance.now() - start;
        previewKindRef.current = 'manifold';
      }

      return true;
    },
    [setGenerationResult, setPieceMeshes]
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

          setGenerationResult(toSingleMesh(result, 'brep'));
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

          // `new Array(n)` returns `any[]`; we pre-size the typed slot.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const meshEntries: PieceMeshEntry[] = new Array(totalCount);
          for (let groupIdx = 0; groupIdx < uniqueGroups.length; groupIdx++) {
            const group = uniqueGroups[groupIdx];
            fillGroupMeshEntries(
              meshEntries,
              group,
              tiling.pieces,
              uniqueResults[groupIdx],
              'brep'
            );
          }

          setSplitProgress(null);
          setPieceMeshes(meshEntries);
          setGenerationResult(EMPTY_MESH);
          setGenerationStatus('complete');
        }
        // Mark this epoch's exact result as authoritative before anything else
        // so a late Manifold draft (async) can't overwrite it — mirrors the
        // bin-designer hook's finalize-first ordering.
        finalizedEpochRef.current = epoch;
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
        // Feed the draft-skip prediction — successful runs only, so a
        // cancelled/errored run can't fake a "fast" BREP.
        if (succeeded) lastBrepMsRef.current = performance.now() - brepStart;
        if (shouldTrack) {
          firstBrepDoneRef.current = true;
          trackBaseplatePreviewTiming({
            directMeshMs: directMeshDurationRef.current,
            previewKind: previewKindRef.current,
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
      // Track edit cadence on every regen, preview bridge or not, so a scrub
      // is recognized from its first rapid edit (see draftPolicy).
      const skipBelowMs = draftSkipGate();
      // Flip to 'generating' before BREP starts so the bottom pill is visible
      // during the draft-only window (when the bridge isn't ready yet).
      // Without this, the pill is hidden for the whole 4-8 s WASM-load period
      // even though the user can see the draft preview.
      setGenerationStatus('generating');

      const preview = previewBridgeRef.current;
      let tiling: BaseplateTiling;
      if (preview && !preview.isDestroyed) {
        // manifold_preview on: draft with the Manifold kernel (real generator,
        // draft quality) instead of the procedural direct-mesh.
        tiling = computeBaseplateTiling(fullParams, bedWidthMm, bedDepthMm);
        setTiling(tiling);
        setSplitProgress(null);
        setDedupStats(null);
        // Skip the draft when BREP is predicted fast — the previous mesh stays
        // on screen until the quick exact crossfades in (no intermediate jump).
        if (lastBrepMsRef.current === null || lastBrepMsRef.current >= skipBelowMs) {
          void runManifoldDraftPreview(fullParams, tiling, epoch).then((handled) => {
            // Draft unavailable/failed and not yet superseded — fall back to the
            // instant procedural preview so the canvas still fills before BREP.
            if (
              !handled &&
              generationEpochRef.current === epoch &&
              epoch > finalizedEpochRef.current
            ) {
              runDirectMeshPreview(fullParams, bedWidthMm, bedDepthMm, epoch);
            }
          });
        }
      } else {
        tiling = runDirectMeshPreview(fullParams, bedWidthMm, bedDepthMm, epoch);
      }

      void runBrepGeneration(fullParams, tiling, epoch);
    },
    [
      setGenerationStatus,
      setTiling,
      setSplitProgress,
      setDedupStats,
      runManifoldDraftPreview,
      runDirectMeshPreview,
      runBrepGeneration,
      draftSkipGate,
    ]
  );

  // Initialize bridge via BridgeManager + worker pool on mount
  useEffect(() => {
    let cancelled = false;
    let acquiredPreview = false;

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
        bridge.onBooleanFallbackStats = trackBooleanFallbacks;

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

        // Best-effort Manifold draft-preview bridge (null when manifold_preview
        // is off or the kernel fails to load — drafts fall back to direct-mesh).
        void bridgeManager
          .acquirePreview()
          .then((previewBridge) => {
            if (cancelled) {
              if (previewBridge) bridgeManager.releasePreview();
              return;
            }
            if (previewBridge) {
              acquiredPreview = true;
              previewBridgeRef.current = previewBridge;
            }
          })
          .catch(() => {
            // Draft preview unavailable; direct-mesh + BREP proceed.
          });

        // Bridge is ready — kick off BREP for the current params. The draft has
        // already populated the canvas via the params-change effect.
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
        useToastStore
          .getState()
          .addToast(t('baseplate.toast.engineInitFailed', { message }), 'error');
        setWasmStatus('error');
        handleWasmLoadFailure(e, 'baseplate_preview');
      });

    return () => {
      cancelled = true;
      bridgeRef.current = null;
      initializedRef.current = false;
      bridgeManager.release();
      previewBridgeRef.current = null;
      if (acquiredPreview) bridgeManager.releasePreview();

      if (poolRef.current) {
        poolRef.current = null;
        workerPoolManager.release();
      }
    };
  }, [setWasmStatus, runBrepGeneration, t]);

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
    // `generationTriggers` carries the trigger-only params (connectorStyle,
    // magnets, padding, corners, …); its reference changes whenever any of them
    // does. The named values are listed because they're read directly above.
  }, [
    generationTriggers,
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    printBedSize,
    printBedDepth,
    fractionalEdgeX,
    fractionalEdgeY,
    runGeneration,
  ]);
}
