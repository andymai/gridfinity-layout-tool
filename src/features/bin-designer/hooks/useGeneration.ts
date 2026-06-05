import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isErr } from '@/core/result';
import { useDesignerStore } from '../store';
import { bridgeManager } from '@/shared/generation/bridge';
import type { GenerationBridge } from '@/shared/generation/bridge';
import { validateCompartmentSizes } from '../utils/validation';
import {
  trackWasmThreadingStatus,
  trackCachePerformance,
  trackKernelPerformance,
  trackBooleanFallbacks,
} from '@/shared/analytics/posthog';
import type { BinParams, GenerationResult } from '../types';

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

  const { params, epoch } = useDesignerStore(
    useShallow((state) => ({
      params: state.params,
      epoch: state.generation.epoch,
    }))
  );

  const setGenerationStatus = useDesignerStore((state) => state.setGenerationStatus);
  const setGenerationResult = useDesignerStore((state) => state.setGenerationResult);
  const setDraftResult = useDesignerStore((state) => state.setDraftResult);
  const setWasmStatus = useDesignerStore((state) => state.setWasmStatus);
  const pushPerfSnapshot = useDesignerStore((state) => state.pushPerfSnapshot);

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
      setGenerationStatus('generating');

      // Fast draft on the leading edge (best-effort): renders immediately while
      // the exact geometry computes. Dropped if superseded or already finalized.
      const preview = previewBridgeRef.current;
      if (preview && !preview.isDestroyed) {
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
            // Draft failure is non-fatal — the exact path below still runs.
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
    [setGenerationStatus, setGenerationResult, setDraftResult, pushPerfSnapshot]
  );

  // Initialize bridge on mount via BridgeManager (ref-counted singleton)
  useEffect(() => {
    let cancelled = false;
    let acquiredPreview = false;
    setWasmStatus('loading');

    bridgeManager
      .acquire()
      .then(async (bridge) => {
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

        // Best-effort draft-preview bridge (null when the flag is off or the
        // Manifold kernel fails to load — never blocks the exact pipeline).
        try {
          const preview = await bridgeManager.acquirePreview();
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cancelled may flip during the await above (cleanup runs in the async gap)
          if (cancelled) {
            if (preview) bridgeManager.releasePreview();
            return;
          }
          if (preview) {
            acquiredPreview = true;
            previewBridgeRef.current = preview;
          }
        } catch {
          // Draft preview unavailable; exact-only generation proceeds.
        }

        // Trigger initial generation
        const currentState = useDesignerStore.getState();
        prevEpochRef.current = currentState.generation.epoch;
        void runGeneration(currentState.params);
      })
      .catch((_e: unknown) => {
        if (!cancelled) setWasmStatus('error');
      });

    return () => {
      cancelled = true;
      bridgeRef.current = null;
      previewBridgeRef.current = null;
      initializedRef.current = false;
      bridgeManager.release();
      if (acquiredPreview) bridgeManager.releasePreview();
    };
  }, [setWasmStatus, runGeneration]);

  // Re-generate when epoch changes (after initialization)
  useEffect(() => {
    if (!initializedRef.current) return;
    if (epoch === prevEpochRef.current) return; // Cache hit — skip regeneration
    prevEpochRef.current = epoch;
    void runGeneration(params);
  }, [epoch, params, runGeneration]);
}
