import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isErr } from '@/core/result';
import { useDesignerStore } from '../store';
import { bridgeManager } from '@/shared/generation/bridge';
import type { GenerationBridge } from '@/shared/generation/bridge';
import { validateCompartmentSizes } from '../utils/validation';
import { trackWasmThreadingStatus } from '@/shared/analytics/posthog';
import type { BinParams } from '../types';

/**
 * Manages the GenerationBridge lifecycle and epoch-based auto-regeneration.
 *
 * Initializes the bridge on mount, triggers generation when epoch changes,
 * skips generation on cache hits (epoch unchanged after undo/redo), and
 * releases the bridge on unmount.
 */
export function useGeneration(): void {
  const bridgeRef = useRef<GenerationBridge | null>(null);
  const initializedRef = useRef(false);
  const prevEpochRef = useRef<number>(-1);

  const { params, epoch } = useDesignerStore(
    useShallow((state) => ({
      params: state.params,
      epoch: state.generation.epoch,
    }))
  );

  const setGenerationStatus = useDesignerStore((state) => state.setGenerationStatus);
  const setGenerationResult = useDesignerStore((state) => state.setGenerationResult);
  const setWasmStatus = useDesignerStore((state) => state.setWasmStatus);

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
        currentParams.compartments.thickness
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

      setGenerationStatus('generating');

      try {
        const result = await bridge.generate(currentParams, () => {});

        setGenerationResult({
          vertices: result.mesh.vertices,
          normals: result.mesh.normals,
          indices: result.mesh.indices,
          edgeVertices: result.mesh.edgeVertices,
          error: null,
          timingMs: result.timingMs,
        });
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
    [setGenerationStatus, setGenerationResult]
  );

  // Initialize bridge on mount via BridgeManager (ref-counted singleton)
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

        // Track WASM threading capabilities for analytics
        const threadingInfo = bridge.getThreadingInfo();
        if (threadingInfo) {
          trackWasmThreadingStatus(threadingInfo.isThreaded, threadingInfo.hardwareConcurrency);
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
      initializedRef.current = false;
      bridgeManager.release();
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
