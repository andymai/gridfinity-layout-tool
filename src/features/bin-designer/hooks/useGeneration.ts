import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isErr } from '@/core/result';
import { useDesignerStore } from '../store';
import { bridgeManager, createDraftSkipGate } from '@/shared/generation/bridge';
import type { GenerationBridge } from '@/shared/generation/bridge';
import { handleWasmLoadFailure } from '@/shared/generation/captureWasmLoadFailure';
import { validateCompartmentSizes } from '../utils/validation';
import {
  trackWasmThreadingStatus,
  trackCachePerformance,
  trackKernelPerformance,
  trackBooleanFallbacks,
} from '@/shared/analytics/posthog';
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
    error: null,
    timingMs: result.timingMs,
  };
}

/**
 * Manages the GenerationBridge lifecycle and epoch-based auto-regeneration.
 *
 * Initializes the bridge on mount, triggers generation when epoch changes,
 * skips generation on cache hits (epoch unchanged after undo/redo), and
 * releases the bridge on unmount.
 *
 * When the `manifold_preview` Labs flag is on, a second (Manifold) bridge
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

  const setGenerationStatus = useDesignerStore((state) => state.setGenerationStatus);
  const setGenerationResult = useDesignerStore((state) => state.setGenerationResult);
  const setDraftResult = useDesignerStore((state) => state.setDraftResult);
  const setWasmStatus = useDesignerStore((state) => state.setWasmStatus);
  const pushPerfSnapshot = useDesignerStore((state) => state.pushPerfSnapshot);

  const dispatchDraft = useCallback(
    (preview: GenerationBridge, currentParams: BinParams, token: number) => {
      void preview
        .generateImmediate(currentParams, () => {})
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
        currentParams.gridUnitMm
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

      // Fast draft on the leading edge (best-effort): renders while the exact
      // geometry computes. Skipped when the exact worker's cache-aware estimate
      // predicts a build faster than the gate's threshold — a draft replaced
      // almost immediately is just flicker, and the threshold drops during a
      // scrub (see draftPolicy). The estimate resolves in a few ms when the
      // worker is idle; null (no history / worker busy mid-generation /
      // timeout) means slow, so the draft proceeds.
      const skipBelowMs = draftSkipGate();
      const preview = previewBridgeRef.current;
      if (preview && !preview.isDestroyed) {
        void bridge.estimateGenerate(currentParams).then((predictedMs) => {
          if (predictedMs !== null && predictedMs < skipBelowMs) return;
          if (token !== genTokenRef.current || token <= finalizedTokenRef.current) return;
          dispatchDraft(preview, currentParams, token);
        });
      }

      try {
        const result = await bridge.generate(currentParams, () => {});

        // A newer edit superseded this one; let its results win instead.
        if (token !== genTokenRef.current) return;
        finalizedTokenRef.current = token;

        if (result.perfSnapshot) pushPerfSnapshot(result.perfSnapshot);

        setGenerationResult(toMeshPayload(result));
        setGenerationStatus('complete');

        // Once the user pauses, speculatively warm the export-quality shell so
        // the first export skips the deferred socket↔body fuse. (Any prior timer
        // was already cleared at the start of this generation.)
        warmTimerRef.current = setTimeout(() => {
          warmTimerRef.current = null;
          bridgeRef.current?.warmExport(currentParams);
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
    [setGenerationStatus, setGenerationResult, dispatchDraft, pushPerfSnapshot, draftSkipGate]
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

        // Track WASM threading capabilities for analytics
        const threadingInfo = bridge.getThreadingInfo();
        if (threadingInfo) {
          trackWasmThreadingStatus(threadingInfo.isThreaded, threadingInfo.hardwareConcurrency);
        }

        // Wire up cache stats and kernel perf reporting to PostHog
        bridge.onCacheStats = trackCachePerformance;
        bridge.onKernelPerfStats = trackKernelPerformance;
        bridge.onBooleanFallbackStats = trackBooleanFallbacks;

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
        setWasmStatus('error');
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
  }, [setWasmStatus, runGeneration, runItemGeneration, dispatchDraft]);

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
}
