/**
 * Hook that manages the GenerationBridge lifecycle for the standalone baseplate page.
 *
 * Three-tier generation (`planPreviewDrafts` picks the ladder per edit):
 *
 *   1. Direct-mesh preview — synchronous procedural generation that runs before
 *      WASM is even loaded, painting an orbitable mesh in ~11 ms.
 *
 *   2. Manifold draft — a WASM round-trip running the real generator at draft
 *      quality, refining tier 1 rather than replacing it.
 *
 *   3. BREP generation — the exact build, which supersedes both. For split
 *      tilings its pieces run in parallel across the worker pool; the split path
 *      waits briefly for a pool still initializing rather than falling back to
 *      generating every piece sequentially (see poolReadiness).
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
import { effectiveGridUnitMmY } from '@/core/types';
import { useTranslation } from '@/i18n';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import {
  bridgeManager,
  workerPoolManager,
  createDraftSkipGate,
  awaitPoolWithin,
  poolIsUsable,
  shouldWaitForPool,
} from '@/shared/generation/bridge';
import type { GenerationBridge } from '@/shared/generation/bridge';
import type { WorkerPool } from '@/shared/generation/bridge';
import { handleWasmLoadFailure } from '@/shared/generation/captureWasmLoadFailure';
import { isUnsupportedWasmError } from '@/shared/generation/wasmLoadError';
import { useToastStore } from '@/core/store/toast';
import { useSettingsStore } from '@/core/store/settings';
import { getStaticTranslation } from '@/i18n';
import { generateBaseplateDirect } from '@/shared/generation/directMesh';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { buildFullParams } from '../utils/buildFullParams';
import { computeBaseplateTiling, bodyParamsForDetach } from '../utils/splitPlanner';
import { shouldDeferBrepPreview, planPreviewDrafts } from '../utils/previewComplexity';
import { groupPiecesByFingerprint } from '../utils/pieceFingerprint';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import type { MarginMeshEntry, PieceMeshEntry } from '../store/baseplatePageStore';
import type { GenerationResult } from '@/shared/generation/bridge';
import type { BaseplateTiling } from '../types/tiling';
import {
  EMPTY_MESH,
  fillGroupMeshEntries,
  toSingleMesh,
  hasMeshOnScreen,
} from './generationMeshEntries';
import { selectGenerationTriggers } from './generationTriggers';
export { selectGenerationTriggers } from './generationTriggers';
export { hasMeshOnScreen } from './generationMeshEntries';

const NO_OP_PROGRESS = (_stage: string, _progress: number): void => {};

/**
 * Manages the GenerationBridge lifecycle and auto-regeneration
 * when layout params change. Uses the shared worker pool for parallel split piece generation.
 */
export function useBaseplateGeneration(): void {
  const t = useTranslation();
  const bridgeRef = useRef<GenerationBridge | null>(null);
  const previewBridgeRef = useRef<GenerationBridge | null>(null);
  const poolRef = useRef<WorkerPool | null>(null);
  /** In-flight pool acquisition, so a split generation can wait on it. */
  const poolPendingRef = useRef<Promise<WorkerPool | null> | null>(null);
  const initializedRef = useRef(false);
  /**
   * Highest epoch whose exact (BREP) result has been applied. The Manifold
   * draft is async, so it can resolve after the BREP it races; dropping drafts
   * at or below this epoch keeps a late draft from overwriting a fresh exact.
   */
  const finalizedEpochRef = useRef(0);
  const generationEpochRef = useRef(0);
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
    drawerOutline,
    gridUnitMm,
    gridUnitMmY,
    magnetAnchor,
    printBedSize,
    printBedDepth,
    fractionalEdgeX,
    fractionalEdgeY,
    gridShiftX,
    gridShiftY,
  } = generationTriggers;

  // Nozzle lives in the settings store (not the layout triggers). Subscribe to it
  // reactively so changing it re-runs the regenerate effect below — otherwise
  // connector geometry stays at the old nozzle until another param changes.
  const nozzleSizeMm = useSettingsStore((s) => s.settings.printSettings.nozzleSizeMm);

  const setGenerationStatus = useBaseplatePageStore((s) => s.setGenerationStatus);
  const setGenerationResult = useBaseplatePageStore((s) => s.setGenerationResult);
  const setWasmStatus = useBaseplatePageStore((s) => s.setWasmStatus);
  const setTiling = useBaseplatePageStore((s) => s.setTiling);
  const setPieceMeshes = useBaseplatePageStore((s) => s.setPieceMeshes);
  const setMarginMeshes = useBaseplatePageStore((s) => s.setMarginMeshes);
  const setConnectorKeyMesh = useBaseplatePageStore((s) => s.setConnectorKeyMesh);
  const setSplitProgress = useBaseplatePageStore((s) => s.setSplitProgress);
  const setDedupStats = useBaseplatePageStore((s) => s.setDedupStats);

  /**
   * Store the seated snap-clip mesh from a batch of piece results (every snap-clip
   * piece carries an identical copy; the first wins), or clear it when none do —
   * e.g. dovetail keys or a single unsplit plate.
   */
  const applyConnectorKeyMesh = useCallback(
    (results: readonly GenerationResult[]): void => {
      for (const r of results) {
        const m = r.mesh.connectorKeyMesh;
        if (m) {
          setConnectorKeyMesh({
            vertices: m.vertices,
            normals: m.normals,
            indices: m.indices,
            triangleCount: m.triangleCount,
          });
          return;
        }
      }
      setConnectorKeyMesh(null);
    },
    [setConnectorKeyMesh]
  );

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
      fullParams: ResolvedBaseplateParams,
      bedWidthMm: number,
      bedDepthMm: number,
      epoch: number,
      // Callers that already computed the tiling pass it in to avoid a second
      // computeBaseplateTiling pass (cheap, but redundant on large plates).
      precomputedTiling?: BaseplateTiling
    ): BaseplateTiling => {
      const start = performance.now();

      const tiling =
        precomputedTiling ?? computeBaseplateTiling(fullParams, bedWidthMm, bedDepthMm);
      setTiling(tiling);
      setSplitProgress(null);
      setDedupStats(null);
      // The procedural direct mesh can't build the relieved clip; clear any stale
      // one so the preview falls back to its draft clip until BREP supplies the
      // exact mesh.
      setConnectorKeyMesh(null);
      // Margin rails are BREP-only; clear any stale rails so they don't linger on
      // the draft until BREP regenerates (or, for a deferred plate, at all).
      setMarginMeshes([]);

      try {
        // The procedural direct mesh only builds rectangles — never show it
        // for a shaped plate (a wrong-shape draft is worse than none; the
        // Manifold draft path runs the real generator and shows the true
        // outline, matching the canBinUseDirectMesh reject-in-the-gate rule).
        // Clear any prior mesh so a stale rectangle can't linger while BREP
        // runs (shouldDeferBrepPreview never defers shaped plates, so BREP
        // always follows).
        if (fullParams.outline !== undefined) {
          setGenerationResult(EMPTY_MESH);
          setPieceMeshes([]);
          return tiling;
        }
        if (!tiling.isSplit) {
          const mesh = generateBaseplateDirect(fullParams, NO_OP_PROGRESS);
          if (generationEpochRef.current !== epoch) return tiling;

          const timingMs = performance.now() - start;
          setGenerationResult(toSingleMesh({ mesh, timingMs }));
          setPieceMeshes([]);
        } else {
          // Split: generate one direct-mesh per unique piece group, clone for duplicates.
          const groups = groupPiecesByFingerprint(tiling.pieces, fullParams);
          const meshEntries = new Array<PieceMeshEntry>(tiling.pieces.length);

          for (const group of groups.values()) {
            const mesh = generateBaseplateDirect(group.params, NO_OP_PROGRESS);
            const result = { mesh, timingMs: 0 };
            fillGroupMeshEntries(meshEntries, group, tiling.pieces, result);
          }

          if (generationEpochRef.current !== epoch) return tiling;

          setPieceMeshes(meshEntries);
          setGenerationResult(EMPTY_MESH);
        }
      } catch {
        // Direct-mesh failed — extremely rare (only on invalid params that
        // would also fail BREP). Leave existing mesh in place; let BREP
        // either succeed (overwriting it) or surface the real error.
      }

      return tiling;
    },
    [
      setTiling,
      setGenerationResult,
      setPieceMeshes,
      setMarginMeshes,
      setConnectorKeyMesh,
      setSplitProgress,
      setDedupStats,
    ]
  );

  /**
   * Phase 1b: a more faithful draft that runs the real `generateBaseplate` on
   * the Manifold kernel at draft quality — same code path as the exact BREP, at
   * the cost of a WASM round-trip. Refines whatever the procedural direct-mesh
   * already painted; a failure is silent because that mesh is still on screen.
   *
   * The exact BREP always supersedes: drafts at or below `finalizedEpochRef`
   * are dropped (the draft is async and may resolve after the BREP it races).
   */
  const runManifoldDraftPreview = useCallback(
    async (
      fullParams: ResolvedBaseplateParams,
      tiling: BaseplateTiling,
      epoch: number
    ): Promise<void> => {
      const preview = previewBridgeRef.current;
      if (!preview || preview.isDestroyed) return;

      const stillCurrent = (): boolean =>
        generationEpochRef.current === epoch && epoch > finalizedEpochRef.current;

      try {
        if (!tiling.isSplit) {
          const result = await preview.generateBaseplate(fullParams, NO_OP_PROGRESS);
          if (!stillCurrent()) return;
          setGenerationResult(toSingleMesh(result));
          setPieceMeshes([]);
        } else {
          const groups = groupPiecesByFingerprint(tiling.pieces, fullParams);
          const meshEntries = new Array<PieceMeshEntry>(tiling.pieces.length);

          for (const group of groups.values()) {
            const baseResult = await preview.generateBaseplate(group.params, NO_OP_PROGRESS);
            if (!stillCurrent()) return;
            fillGroupMeshEntries(meshEntries, group, tiling.pieces, baseResult);
          }

          if (!stillCurrent()) return;
          setPieceMeshes(meshEntries);
          setGenerationResult(EMPTY_MESH);
        }
      } catch {
        // Draft failed — the procedural direct-mesh painted before this call is
        // still on screen, and the exact BREP still follows.
      }
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
    async (fullParams: ResolvedBaseplateParams, tiling: BaseplateTiling, epoch: number) => {
      const bridge = bridgeRef.current;
      if (!bridge || bridge.isDestroyed) return;

      const brepStart = performance.now();
      let succeeded = false;
      setGenerationStatus('generating');

      try {
        if (!tiling.isSplit) {
          // Detached sides print padding-free on the body; the rails carry that
          // margin. Computed AFTER the tiling above so `emitMargins` still saw
          // the true padding.
          const bodyParams = bodyParamsForDetach(fullParams);
          const result = await bridge.generateBaseplate(bodyParams, NO_OP_PROGRESS);
          if (generationEpochRef.current !== epoch) return;

          setGenerationResult(toSingleMesh(result));
          setPieceMeshes([]);
          setConnectorKeyMesh(null);
          setGenerationStatus('complete');
        } else {
          const groups = groupPiecesByFingerprint(tiling.pieces, fullParams);
          const uniqueGroups = [...groups.values()];
          const uniqueCount = uniqueGroups.length;
          const totalCount = tiling.pieces.length;
          const duplicatesSkipped = totalCount - uniqueCount;

          setDedupStats({ uniqueCount, totalCount, duplicatesSkipped });
          setSplitProgress({ current: 0, total: uniqueCount });

          // The pool is acquired in the background, so the FIRST generation of a
          // session always finds it missing and used to run every piece
          // sequentially on the single bridge — the 10.1x cold penalty on split
          // plates, against 3.4x on unsplit ones where the pool cannot help.
          // Wait for the in-flight acquisition instead, bounded so a pool that
          // never lands still degrades to the sequential path.
          let pool = poolRef.current;
          if (shouldWaitForPool(pool, uniqueCount)) {
            pool = await awaitPoolWithin(poolPendingRef.current);
            if (generationEpochRef.current !== epoch) return;
          }

          const uniqueParams = uniqueGroups.map((g) => g.params);
          let uniqueResults: GenerationResult[];

          if (poolIsUsable(pool)) {
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

          const meshEntries = new Array<PieceMeshEntry>(totalCount);
          for (let groupIdx = 0; groupIdx < uniqueGroups.length; groupIdx++) {
            const group = uniqueGroups[groupIdx];
            fillGroupMeshEntries(meshEntries, group, tiling.pieces, uniqueResults[groupIdx]);
          }

          setSplitProgress(null);
          setPieceMeshes(meshEntries);
          applyConnectorKeyMesh(uniqueResults);
          setGenerationResult(EMPTY_MESH);
          setGenerationStatus('complete');
        }

        // Detached margin rails: generate each from the ORIGINAL params (so the
        // rail's over-tile pockets align with the body grid) and place by mm
        // offset. Sequential — they share the bridge's single-request channel.
        if (tiling.margins.length > 0) {
          const railEntries: MarginMeshEntry[] = [];
          for (const margin of tiling.margins) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- re-check between async iterations
            if (bridge.isDestroyed || generationEpochRef.current !== epoch) return;
            const railResult = await bridge.generateMargin(fullParams, margin);
            if (generationEpochRef.current !== epoch) return;
            railEntries.push({
              id: margin.id,
              side: margin.side,
              mesh: toSingleMesh(railResult),
              worldOffsetMm: margin.worldOffsetMm,
              lengthMm: margin.lengthMm,
              bandThicknessMm: margin.bandThicknessMm,
              col: margin.col,
              row: margin.row,
            });
          }
          setMarginMeshes(railEntries);
        } else {
          setMarginMeshes([]);
        }
        // Mark this epoch's exact result as authoritative before anything else
        // so a late Manifold draft (async) can't overwrite it — mirrors the
        // bin-designer hook's finalize-first ordering.
        finalizedEpochRef.current = epoch;
        succeeded = true;
      } catch (e: unknown) {
        // These three early returns are intentional non-events: bridge
        // cancellation (e.g. unmount) and superseded epochs aren't user-
        // visible failures, so they don't count as a real BREP completion.
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
          setMarginMeshes([]);
          setGenerationStatus('error');
        }
      } finally {
        // Feed the draft-skip prediction — successful runs only, so a
        // cancelled/errored run can't fake a "fast" BREP.
        if (succeeded) lastBrepMsRef.current = performance.now() - brepStart;
      }
    },
    [
      setGenerationStatus,
      setGenerationResult,
      setPieceMeshes,
      setMarginMeshes,
      applyConnectorKeyMesh,
      setConnectorKeyMesh,
      setSplitProgress,
      setDedupStats,
    ]
  );

  /**
   * Combined flow: direct-mesh always runs; BREP only if bridge is ready.
   * If the bridge isn't ready yet, the direct-mesh preview stays on screen
   * and BREP kicks in once `bridgeManager.acquire()` resolves (mount effect).
   */
  const runGeneration = useCallback(
    (fullParams: ResolvedBaseplateParams, bedWidthMm: number, bedDepthMm: number) => {
      const epoch = ++generationEpochRef.current;
      // Track edit cadence on every regen, preview bridge or not, so a scrub
      // is recognized from its first rapid edit (see draftPolicy).
      const { skipBelowMs } = draftSkipGate();
      // Flip to 'generating' before BREP starts so the bottom pill is visible
      // during the draft-only window (when the bridge isn't ready yet).
      // Without this, the pill is hidden for the whole 4-8 s WASM-load period
      // even though the user can see the draft preview.
      setGenerationStatus('generating');

      const tiling = computeBaseplateTiling(fullParams, bedWidthMm, bedDepthMm);

      // Large magnet plates can exceed the per-piece BREP budget on slower
      // hardware — the user would wait out the whole timeout only to fall back
      // to the (already faithful) direct-mesh. Skip that gamble: keep the
      // instant procedural mesh on screen and mark the preview complete. Export
      // rebuilds at full BREP fidelity via its own (larger-budget) path.
      if (shouldDeferBrepPreview(tiling, fullParams, lastBrepMsRef.current)) {
        runDirectMeshPreview(fullParams, bedWidthMm, bedDepthMm, epoch, tiling);
        // Claim this epoch as final so a late async draft can't overwrite it.
        finalizedEpochRef.current = epoch;
        setGenerationStatus('complete');
        return;
      }

      const preview = previewBridgeRef.current;
      const plan = planPreviewDrafts({
        params: fullParams,
        hasPreviewBridge: preview !== null && !preview.isDestroyed,
        lastBrepMs: lastBrepMsRef.current,
        skipBelowMs,
      });

      if (plan === 'none') {
        // Keep the last good mesh on screen (never blank to EMPTY_MESH mid-edit)
        // and let the exact BREP replace it. Still publish the tiling/progress so
        // the split overlay tracks the new piece layout while the exact runs.
        setTiling(tiling);
        setSplitProgress(null);
        setDedupStats(null);
      } else {
        // `runDirectMeshPreview` publishes the tiling itself.
        runDirectMeshPreview(fullParams, bedWidthMm, bedDepthMm, epoch, tiling);
        if (plan === 'direct-then-manifold') {
          void runManifoldDraftPreview(fullParams, tiling, epoch);
        }
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

        // Acquire the shared worker pool in the background, so the first draft
        // and BREP are not held behind N more WASM instances. The promise is
        // kept: a SPLIT generation that finds no pool yet waits briefly on it
        // rather than running every piece sequentially (see poolReadiness).
        const pending = workerPoolManager
          .acquire()
          .then((pool) => {
            if (cancelled) {
              workerPoolManager.release();
              return null;
            }
            poolRef.current = pool;
            return pool;
          })
          .catch(() => {
            // Non-fatal — falls back to sequential generation
            return null;
          });
        poolPendingRef.current = pending;

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
          layoutState.layout.drawer.fractionalEdgeY ?? 'end',
          useSettingsStore.getState().settings.printSettings.nozzleSizeMm,
          layoutState.layout.drawer.outline,
          layoutState.layout.magnetAnchor,
          effectiveGridUnitMmY(layoutState.layout),
          layoutState.layout.drawer.gridShiftX ?? 0,
          layoutState.layout.drawer.gridShiftY ?? 0
        );
        const bedW = layoutState.layout.printBedSize;
        const bedD = layoutState.layout.printBedDepth ?? layoutState.layout.printBedSize;
        const epoch = ++generationEpochRef.current;
        const tiling = computeBaseplateTiling(params, bedW, bedD);
        // Mirror runGeneration's deferral: if the stored plate is predicted too
        // expensive, don't kick off the doomed BREP on bridge-ready — the
        // params-change effect already left the faithful direct-mesh on screen.
        if (shouldDeferBrepPreview(tiling, params, lastBrepMsRef.current)) {
          finalizedEpochRef.current = epoch;
          setGenerationStatus('complete');
        } else {
          void runBrepGeneration(params, tiling, epoch);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        // The raw compile error names a byte offset in a binary the user did
        // not ask about; the in-canvas panel says the useful part instead.
        if (isUnsupportedWasmError(e)) {
          setWasmStatus('unsupported');
        } else {
          const message = e instanceof Error ? e.message : String(e);
          useToastStore
            .getState()
            .addToast(t('baseplate.toast.engineInitFailed', { message }), 'error');
          setWasmStatus('error');
        }
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
  }, [setWasmStatus, setGenerationStatus, runBrepGeneration, t]);

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
      fractionalEdgeY,
      nozzleSizeMm,
      drawerOutline,
      magnetAnchor,
      gridUnitMmY,
      gridShiftX,
      gridShiftY
    );
    runGeneration(params, printBedSize, printBedDepth ?? printBedSize);
    // `generationTriggers` carries the trigger-only params (connectorStyle,
    // magnets, padding, corners, …); its reference changes whenever any of them
    // does. The named values are listed because they're read directly above.
  }, [
    generationTriggers,
    drawerWidth,
    drawerDepth,
    drawerOutline,
    gridUnitMm,
    gridUnitMmY,
    magnetAnchor,
    printBedSize,
    printBedDepth,
    fractionalEdgeX,
    fractionalEdgeY,
    gridShiftX,
    gridShiftY,
    nozzleSizeMm,
    runGeneration,
  ]);
}
