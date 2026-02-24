/**
 * Hook that manages the generation bridge lifecycle.
 *
 * Subscribes to designer store epoch changes, auto-generates on change (debounced),
 * and updates the store with mesh results. Skips regeneration on cache hits
 * (epoch unchanged after undo/redo with cached mesh).
 *
 * Lifecycle:
 * 1. Mount: Initialize bridge worker
 * 2. Epoch change: Debounced generate (adaptive delay via bridge)
 * 3. Unmount: Destroy bridge and worker
 */

import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isErr } from '@/core/result';
import { useDesignerStore } from '../store';
import { GenerationBridge, setActiveBridge } from '@/shared/generation/bridge';
import { validateCompartmentSizes } from '../utils/validation';
import { trackWasmThreadingStatus } from '@/shared/analytics/posthog';
import type { BinParams } from '../types';

/**
 * Manages the GenerationBridge lifecycle and epoch-based auto-regeneration.
 *
 * - Initializes the worker on mount
 * - Triggers generation when epoch changes (param mutations)
 * - Skips generation when epoch is unchanged (cache hit on undo/redo)
 * - Cleans up the worker on unmount
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
        const result = await bridge.generate(currentParams, (stage, progress) => {
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
        setWasmStatus('error');
      });

    return () => {
      bridge.destroy();
      bridgeRef.current = null;
      initializedRef.current = false;
      setActiveBridge(null);
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
