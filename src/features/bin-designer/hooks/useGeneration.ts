import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isErr } from '@/core/result';
import { useDesignerStore } from '../store';
import { useSettingsStore } from '@/core/store';
import {
  bridgeManager,
  createDraftSkipGate,
  getActiveKernel,
  EXACT_IMMEDIATE_MAX_MS,
  FORCE_DRAFT_AFTER_EXACT_MS,
} from '@/shared/generation/bridge';
import type { GenerationBridge } from '@/shared/generation/bridge';
import { generateBinDirect, canBinUseDirectMesh } from '@/shared/generation/directMesh';
import { handleWasmLoadFailure } from '@/shared/generation/captureWasmLoadFailure';
import { isUnsupportedWasmError } from '@/shared/generation/wasmLoadError';
import { withSocketNozzle } from '@/shared/generation/socketNozzle';
import {
  binMeshCacheKey,
  loadPersistedBinMesh,
  savePersistedBinMesh,
} from '@/shared/generation/meshPersistence';
import type { MeshData } from '@/shared/types/generation';
import { validateCompartmentSizes } from '../utils/validation';
import type { BinParams, GenerationResult } from '../types';
import type { GridfinityItem } from '@/shared/types/item';

type BridgeResult = Awaited<ReturnType<GenerationBridge['generate']>>;

/**
 * Map a worker generation result to the store's mesh payload. The typed-array
 * buffers are referenced as-is — the worker cloned them before transfer, so
 * they're detached from worker memory — while the `readonly` faceGroups arrays
 * are spread into mutable copies the Immer store can ingest.
 */
function toMeshPayload(result: BridgeResult): GenerationResult {
  return {
    vertices: result.mesh.vertices,
    normals: result.mesh.normals,
    indices: result.mesh.indices,
    edgeVertices: result.mesh.edgeVertices,
    faceGroups: result.mesh.faceGroups ? [...result.mesh.faceGroups] : undefined,
    coarseLOD: result.mesh.coarseLOD,
    lidMesh: result.mesh.lidMesh
      ? {
          ...result.mesh.lidMesh,
          faceGroups: result.mesh.lidMesh.faceGroups
            ? [...result.mesh.lidMesh.faceGroups]
            : undefined,
        }
      : undefined,
    // Stack plate has no face groups; the readonly typed arrays are ingested
    // directly (Immer treats typed arrays as opaque leaves).
    stackPlateMesh: result.mesh.stackPlateMesh,
    slideTrayMesh: result.mesh.slideTrayMesh,
    detachableFeetMesh: result.mesh.detachableFeetMesh,
    knifeRestMesh: result.mesh.knifeRestMesh,
    labelPlates: result.mesh.labelPlates,
    labelTextOverflow: result.mesh.labelTextOverflow,
    typeStemWarning: result.mesh.typeStemWarning,
    error: null,
    timingMs: result.timingMs,
  };
}

/**
 * Map a raw persisted `MeshData` (loaded from IndexedDB) to the store's mesh
 * payload. Mirrors `toMeshPayload` but sources a bare mesh rather than a bridge
 * result; the readonly faceGroups are spread into a mutable copy for Immer.
 */
function meshDataToPayload(mesh: MeshData): GenerationResult {
  return {
    vertices: mesh.vertices,
    normals: mesh.normals,
    indices: mesh.indices,
    edgeVertices: mesh.edgeVertices,
    faceGroups: mesh.faceGroups ? [...mesh.faceGroups] : undefined,
    coarseLOD: mesh.coarseLOD,
    lidMesh: mesh.lidMesh
      ? {
          ...mesh.lidMesh,
          faceGroups: mesh.lidMesh.faceGroups ? [...mesh.lidMesh.faceGroups] : undefined,
        }
      : undefined,
    stackPlateMesh: mesh.stackPlateMesh,
    slideTrayMesh: mesh.slideTrayMesh,
    detachableFeetMesh: mesh.detachableFeetMesh,
    knifeRestMesh: mesh.knifeRestMesh,
    labelPlates: mesh.labelPlates,
    labelTextOverflow: mesh.labelTextOverflow,
    typeStemWarning: mesh.typeStemWarning,
    error: null,
    timingMs: 0,
  };
}

/**
 * Map a synchronous direct-mesh draft to the store's mesh payload. The arrays
 * are freshly allocated by the procedural generator (no worker transfer), so
 * they're referenced as-is; the draft carries no face groups or LOD.
 */
function directMeshToPayload(
  mesh: ReturnType<typeof generateBinDirect>,
  timingMs: number
): GenerationResult {
  return {
    vertices: mesh.vertices,
    normals: mesh.normals,
    indices: mesh.indices,
    edgeVertices: mesh.edgeVertices,
    error: null,
    timingMs,
  };
}

/**
 * Manages the GenerationBridge lifecycle and epoch-based auto-regeneration.
 *
 * Initializes the bridge on mount, triggers generation when epoch changes,
 * skips generation on cache hits (epoch unchanged after undo/redo), and
 * releases the bridge on unmount.
 *
 * A second (Manifold) bridge
 * renders a fast draft on the leading edge of each edit while the exact
 * occt-wasm geometry computes; the exact result always supersedes the draft.
 * A monotonic token guards arbitration: a draft is dropped if a newer edit has
 * started or the exact result for its edit has already landed.
 */
/** Idle gap after the exact result before speculatively warming the export shell. */
const EXPORT_WARM_IDLE_MS = 2000;

export function useGeneration(): void {
  const bridgeRef = useRef<GenerationBridge | null>(null);
  const previewBridgeRef = useRef<GenerationBridge | null>(null);
  const initializedRef = useRef(false);
  const prevEpochRef = useRef(-1);
  // Monotonic per-generation token; the most recent dispatch wins.
  const genTokenRef = useRef(0);
  // Highest token whose exact result has been applied — drafts at or below it
  // are stale and dropped (covers the exact-resolves-before-draft race).
  const finalizedTokenRef = useRef(0);
  // Highest token for which a synchronous direct-mesh draft already painted —
  // suppresses the slower Manifold draft so a simple bin doesn't flash
  // direct → manifold → exact (two visible swaps).
  const directShownTokenRef = useRef(0);
  // Duration of the most recent exact build. A slow last exact forces the draft
  // on the next edit even if the estimate predicts fast, so a heavy design whose
  // estimate under-predicts still gets interim feedback.
  const lastExactMsRef = useRef(0);
  const draftSkipGate = useRef(createDraftSkipGate()).current;
  // After the exact result settles, idle-warm the export-quality (fused) shell
  // so the first export skips the deferred socket↔body fuse. Cancelled (timer
  // cleared) on the next edit so the warm only runs when the user has paused.
  const warmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { params, epoch, itemKind, structure, envelope } = useDesignerStore(
    useShallow((state) => ({
      params: state.params,
      epoch: state.generation.epoch,
      itemKind: state.itemKind,
      structure: state.structure,
      envelope: state.envelope,
    }))
  );

  // Nozzle is a live print SETTING, not part of the persisted design. Socket-mode
  // bins scale their pocket clearance to it (`withSocketNozzle`), so a nozzle
  // change must regenerate even though it doesn't bump the design epoch.
  const nozzleSizeMm = useSettingsStore((state) => state.settings.printSettings.nozzleSizeMm);
  const prevNozzleRef = useRef(nozzleSizeMm);

  const setGenerationStatus = useDesignerStore((state) => state.setGenerationStatus);
  const setGenerationResult = useDesignerStore((state) => state.setGenerationResult);
  const setDraftResult = useDesignerStore((state) => state.setDraftResult);
  const setWasmStatus = useDesignerStore((state) => state.setWasmStatus);
  const pushPerfSnapshot = useDesignerStore((state) => state.pushPerfSnapshot);

  const dispatchDraft = useCallback(
    (preview: GenerationBridge, currentParams: BinParams, token: number) => {
      void preview
        .generateImmediate(
          withSocketNozzle(
            currentParams,
            useSettingsStore.getState().settings.printSettings.nozzleSizeMm
          ),
          () => {}
        )
        .then((draft) => {
          if (token !== genTokenRef.current || token <= finalizedTokenRef.current) return;
          // Draft perf is intentionally not pushed to perfHistory — the overlay
          // diagnoses the exact pipeline, and interleaving draft-kernel timings
          // would skew it. Only the exact result records a snapshot.
          setDraftResult(toMeshPayload(draft));
        })
        .catch(() => {
          // Draft failure is non-fatal — the exact path still runs.
        });
    },
    [setDraftResult]
  );

  // Generate bin mesh from current params
  const runGeneration = useCallback(
    async (currentParams: BinParams) => {
      const bridge = bridgeRef.current;
      if (!bridge || bridge.isDestroyed) return;

      // Pre-flight validation: reject degenerate compartment configurations
      const compartmentCheck = validateCompartmentSizes(
        currentParams.width,
        currentParams.depth,
        currentParams.wallThickness,
        currentParams.compartments.cols,
        currentParams.compartments.rows,
        currentParams.compartments.thickness,
        currentParams.gridUnitMm,
        currentParams.gridUnitMmY
      );
      if (isErr(compartmentCheck)) {
        setGenerationResult({
          vertices: null,
          normals: null,
          indices: null,
          edgeVertices: null,
          error: compartmentCheck.error.message,
          timingMs: 0,
        });
        setGenerationStatus('error');
        return;
      }

      const token = ++genTokenRef.current;
      // A new edit cancels any pending idle export-warm.
      if (warmTimerRef.current !== null) {
        clearTimeout(warmTimerRef.current);
        warmTimerRef.current = null;
      }
      setGenerationStatus('generating');

      // Merge the live nozzle setting into a throwaway params object for every
      // generation-affecting call below (worker, direct mesh, estimate, cache
      // key, export warm) so a socket's clearance scales with the nozzle. The
      // persisted design (autosave) keeps using `currentParams` — nozzle-free.
      const genParams = withSocketNozzle(
        currentParams,
        useSettingsStore.getState().settings.printSettings.nozzleSizeMm
      );

      // Instant synchronous draft (best-effort): for the common rectangular bin,
      // emit a procedural mesh on the main thread — no kernel, no WASM round-trip
      // — so something paints on the leading edge of an edit before the worker
      // even starts. Gated to bins the direct path renders faithfully; a throw
      // (degenerate input) silently degrades to the async paths below.
      if (canBinUseDirectMesh(genParams)) {
        try {
          const start = performance.now();
          const mesh = generateBinDirect(genParams);
          if (token === genTokenRef.current && token > finalizedTokenRef.current) {
            setDraftResult(directMeshToPayload(mesh, performance.now() - start));
            directShownTokenRef.current = token;
          }
        } catch {
          // No instant draft for this edit; the async draft/exact still run.
        }
      }

      // One cache-aware estimate serves two decisions: whether to show the fast
      // Manifold draft on the leading edge, and whether the exact is cheap
      // enough to fire immediately (skipping the debounce). A null estimate
      // means the worker is busy or has no history, treated as slow. That also
      // keeps the immediate path unreachable, so a heavy in-flight op is never
      // pre-empted by an early exact it cannot cancel.
      const { skipBelowMs, scrubbing } = draftSkipGate();
      const predictedMs = await bridge.estimateGenerate(genParams);
      // A newer edit superseded this one during the estimate round-trip.
      if (token !== genTokenRef.current) return;

      // Fast draft (best-effort): renders while the exact geometry computes.
      // Skipped when the estimate predicts a build faster than the gate's
      // threshold (a draft replaced almost immediately is just flicker), and the
      // threshold drops during a scrub (see draftPolicy). Suppressed when the
      // synchronous direct mesh already painted this edit. Forced regardless of
      // the estimate once the last exact was slow: the estimate can under-predict
      // a heavy design, and skipping the draft there strands a multi-second
      // exact with no interim feedback.
      const lastExactSlow = lastExactMsRef.current >= FORCE_DRAFT_AFTER_EXACT_MS;
      const preview = previewBridgeRef.current;
      if (
        preview &&
        !preview.isDestroyed &&
        directShownTokenRef.current !== token &&
        token > finalizedTokenRef.current &&
        (lastExactSlow || !(predictedMs !== null && predictedMs < skipBelowMs))
      ) {
        dispatchDraft(preview, genParams, token);
      }

      // Fire the exact immediately (no debounce) only when it is predicted
      // cheap, the worker is idle (non-null estimate), and this is not a scrub.
      // A wasted immediate exact then costs at most EXACT_IMMEDIATE_MAX_MS and
      // cannot wedge the worker. Everything heavier keeps the adaptive debounce,
      // whose latency the draft masks.
      const fireImmediate =
        predictedMs !== null && predictedMs < EXACT_IMMEDIATE_MAX_MS && !scrubbing;

      try {
        // Only the designer preview renders label plates (preview).
        const result = fireImmediate
          ? await bridge.generateImmediate(genParams, undefined, true)
          : await bridge.generate(genParams, undefined, true);

        // A newer edit superseded this one; let its results win instead.
        if (token !== genTokenRef.current) return;
        finalizedTokenRef.current = token;
        lastExactMsRef.current = result.timingMs;

        if (result.perfSnapshot) pushPerfSnapshot(result.perfSnapshot);

        setGenerationResult(toMeshPayload(result));
        setGenerationStatus('complete');

        // Persist the exact preview mesh so reopening this design next session
        // paints instantly (pre-draft) instead of re-paying the cold start.
        // Fire-and-forget; refreshes LRU freshness even when the entry exists.
        //
        // Label plates are stripped first: this store is keyed by
        // `binMeshCacheKey` and shared with the layout planner's linked-design
        // meshes, which never render plates. Persisting them would bloat every
        // entry the layout later reads back — the designer rebuilds them cheaply
        // on the next generation.
        const { labelPlates, ...withoutPlates } = result.mesh;
        savePersistedBinMesh(
          binMeshCacheKey(genParams, getActiveKernel()),
          labelPlates ? withoutPlates : result.mesh
        );

        // Once the user pauses, speculatively warm the export-quality shell so
        // the first export skips the deferred socket↔body fuse. (Any prior timer
        // was already cleared at the start of this generation.)
        warmTimerRef.current = setTimeout(() => {
          warmTimerRef.current = null;
          bridgeRef.current?.warmExport(genParams);
        }, EXPORT_WARM_IDLE_MS);
      } catch (e) {
        // Cancelled requests are expected during rapid param changes
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
    [
      setGenerationStatus,
      setGenerationResult,
      setDraftResult,
      dispatchDraft,
      pushPerfSnapshot,
      draftSkipGate,
    ]
  );

  // Generate a non-bin item mesh via the generic GENERATE_ITEM path. No draft /
  // compartment validation / export-warm — those are bin-specific.
  const runItemGeneration = useCallback(
    async (item: GridfinityItem) => {
      const bridge = bridgeRef.current;
      if (!bridge || bridge.isDestroyed) return;

      const token = ++genTokenRef.current;
      setGenerationStatus('generating');
      try {
        const result = await bridge.generateItem(item, () => {});
        if (token !== genTokenRef.current) return;
        finalizedTokenRef.current = token;
        if (result.perfSnapshot) pushPerfSnapshot(result.perfSnapshot);
        setGenerationResult(toMeshPayload(result));
        setGenerationStatus('complete');
      } catch (e) {
        if (e instanceof Error && e.message === 'Generation cancelled') return;
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
    [setGenerationStatus, setGenerationResult, pushPerfSnapshot]
  );

  // Initialize bridge on mount via BridgeManager (ref-counted singleton)
  useEffect(() => {
    let cancelled = false;
    let acquiredPreview = false;
    setWasmStatus('loading');

    // Instant pre-draft from last session (best-effort): a saved bin's exact
    // preview mesh persisted to IndexedDB paints in tens of ms while occt-wasm
    // (~2-4s) loads. Only when nothing has painted yet; it claims the token so
    // the exact generation (and nothing else) supersedes it through normal
    // arbitration, the same way the Manifold pre-draft does. Not for generic items.
    const initialState = useDesignerStore.getState();
    if (initialState.itemKind === 'bin') {
      // Match the nozzle-merged key the exact mesh was persisted under, so a
      // socket bin on a wide nozzle still finds its saved pre-draft.
      const nozzle = useSettingsStore.getState().settings.printSettings.nozzleSizeMm;
      // Same kernel the bridge below is about to be constructed with, so the
      // pre-draft only matches a mesh THIS engine persisted.
      const kernel = getActiveKernel();
      const initialKey = binMeshCacheKey(withSocketNozzle(initialState.params, nozzle), kernel);
      void loadPersistedBinMesh(initialKey).then((cached) => {
        if (cancelled || !cached) return;
        if (genTokenRef.current !== 0 || finalizedTokenRef.current > 0) return;
        // Params can change while occt-wasm loads (edits don't regenerate until
        // the bridge is ready, so the token stays 0). Don't paint a pre-draft
        // for params the user has already moved on from.
        const now = useDesignerStore.getState();
        if (
          now.itemKind !== 'bin' ||
          binMeshCacheKey(withSocketNozzle(now.params, nozzle), kernel) !== initialKey
        )
          return;
        // Claim the generation token before painting. The Manifold pre-draft
        // fires only while the token is still 0, so without this a slower
        // Manifold draft would overwrite this exact-quality cached mesh with a
        // coarse approximation. The initial exact generation takes the next
        // token and supersedes this through normal arbitration.
        ++genTokenRef.current;
        setDraftResult(meshDataToPayload(cached));
      });
    }

    bridgeManager
      .acquire()
      .then((bridge) => {
        if (cancelled) {
          bridgeManager.release();
          return;
        }
        bridgeRef.current = bridge;
        setWasmStatus('ready');
        // Mark ready as soon as the exact bridge is up — deliberately before the
        // preview bridge is acquired below. The draft is a best-effort
        // enhancement; gating readiness on it would make edits during the
        // Manifold WASM load (which can lag the exact bridge) do nothing at all.
        // Edits in that brief window simply run exact-only until the preview joins.
        initializedRef.current = true;

        // Trigger the initial generation immediately — deliberately NOT gated on
        // the preview bridge. The first render runs exact-only; gating it on
        // the optional Manifold WASM load would make the first paint slower
        // than with the flag off. The draft joins for subsequent edits.
        const currentState = useDesignerStore.getState();
        prevEpochRef.current = currentState.generation.epoch;
        if (currentState.itemKind !== 'bin' && currentState.structure && currentState.envelope) {
          void runItemGeneration({
            envelope: currentState.envelope,
            structure: currentState.structure,
          });
        } else {
          void runGeneration(currentState.params);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setWasmStatus(isUnsupportedWasmError(e) ? 'unsupported' : 'error');
        handleWasmLoadFailure(e, 'bin_designer_preview');
      });

    // Acquire the best-effort draft-preview bridge in parallel with the exact
    // bridge above (null when the flag is off or the kernel fails to load —
    // never fatal). Its WASM is a fraction of occt-wasm's, so on a cold start
    // it typically resolves seconds earlier; if no generation has started yet,
    // render a pre-draft instead of leaving the skeleton up for the whole
    // exact-worker load. The pre-draft claims a token so the initial exact
    // generation (and any edit) supersedes it through normal arbitration.
    void bridgeManager
      .acquirePreview()
      .then((preview) => {
        if (!preview) return;
        if (cancelled) {
          bridgeManager.releasePreview();
          return;
        }
        acquiredPreview = true;
        previewBridgeRef.current = preview;
        if (genTokenRef.current === 0) {
          const token = ++genTokenRef.current;
          dispatchDraft(preview, useDesignerStore.getState().params, token);
        }
      })
      .catch(() => {
        // Draft preview unavailable; exact-only generation proceeds.
      });

    return () => {
      cancelled = true;
      if (warmTimerRef.current !== null) {
        clearTimeout(warmTimerRef.current);
        warmTimerRef.current = null;
      }
      bridgeRef.current = null;
      previewBridgeRef.current = null;
      initializedRef.current = false;
      bridgeManager.release();
      if (acquiredPreview) bridgeManager.releasePreview();
    };
  }, [setWasmStatus, setDraftResult, runGeneration, runItemGeneration, dispatchDraft]);

  // Re-generate when epoch changes (after initialization)
  useEffect(() => {
    if (!initializedRef.current) return;
    if (epoch === prevEpochRef.current) return; // Cache hit — skip regeneration
    prevEpochRef.current = epoch;
    if (itemKind !== 'bin' && structure && envelope) {
      void runItemGeneration({ envelope, structure });
    } else {
      void runGeneration(params);
    }
  }, [epoch, params, itemKind, structure, envelope, runGeneration, runItemGeneration]);

  // Re-generate when the print nozzle changes. Nozzle is not part of the design
  // (so it doesn't bump the epoch), but a socket bin's pocket clearance scales
  // with it. Gate on `withSocketNozzle` itself (the single source of truth for
  // "does the nozzle change geometry here") so we skip regen when it wouldn't —
  // labels disabled, non-socket, or both nozzles at/below the 0.4mm baseline.
  useEffect(() => {
    const prevNozzle = prevNozzleRef.current;
    if (prevNozzle === nozzleSizeMm) return;
    prevNozzleRef.current = nozzleSizeMm;
    if (!initializedRef.current || itemKind !== 'bin') return;
    const before = withSocketNozzle(params, prevNozzle).nozzleSizeMm;
    const after = withSocketNozzle(params, nozzleSizeMm).nozzleSizeMm;
    if (before === after) return;
    void runGeneration(params);
  }, [nozzleSizeMm, itemKind, params, runGeneration]);
}
