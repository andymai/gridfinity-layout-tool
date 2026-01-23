/**
 * Hook that manages the generation bridge lifecycle.
 *
 * Subscribes to designer store param changes, auto-generates on change (debounced),
 * and updates the store with mesh results.
 *
 * Lifecycle:
 * 1. Mount: Initialize bridge worker
 * 2. Params change: Debounced generate (200ms via bridge)
 * 3. Unmount: Destroy bridge and worker
 */

import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useDesignerStore } from '../store';
import { GenerationBridge, setActiveBridge } from '@/features/generation/bridge';
import type { BinParams } from '../types';

/**
 * Manages the GenerationBridge lifecycle and auto-regeneration.
 *
 * - Initializes the worker on mount
 * - Triggers generation whenever params change
 * - Cleans up the worker on unmount
 */
export function useGeneration(): void {
  const bridgeRef = useRef<GenerationBridge | null>(null);
  const initializedRef = useRef(false);

  const params = useDesignerStore(
    useShallow((state) => state.params)
  );

  const setGenerationStatus = useDesignerStore((state) => state.setGenerationStatus);
  const setGenerationResult = useDesignerStore((state) => state.setGenerationResult);
  const setWasmStatus = useDesignerStore((state) => state.setWasmStatus);

  // Generate mesh from current params
  const runGeneration = useCallback(async (currentParams: BinParams) => {
    const bridge = bridgeRef.current;
    if (!bridge || bridge.isDestroyed) return;

    setGenerationStatus('generating');

    try {
      const result = await bridge.generate(currentParams, (stage, progress) => {
        // Progress updates could be wired to UI in future
        void stage;
        void progress;
      });

      setGenerationResult({
        vertices: result.mesh.vertices,
        normals: result.mesh.normals,
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
        error: e instanceof Error ? e.message : String(e),
        timingMs: 0,
      });
      setGenerationStatus('error');
    }
  }, [setGenerationStatus, setGenerationResult]);

  // Initialize bridge on mount
  useEffect(() => {
    const bridge = new GenerationBridge();
    bridgeRef.current = bridge;
    setActiveBridge(bridge);

    setWasmStatus('loading');

    bridge.init()
      .then(() => {
        setWasmStatus('ready');
        initializedRef.current = true;
        // Trigger initial generation
        const currentParams = useDesignerStore.getState().params;
        void runGeneration(currentParams);
      })
      .catch((_e) => {
        setWasmStatus('error');
      });

    return () => {
      bridge.destroy();
      bridgeRef.current = null;
      initializedRef.current = false;
      setActiveBridge(null);
    };
  }, [setWasmStatus, runGeneration]);

  // Re-generate when params change (after initialization)
  useEffect(() => {
    if (!initializedRef.current) return;
    void runGeneration(params);
  }, [params, runGeneration]);
}
