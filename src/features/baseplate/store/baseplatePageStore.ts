/**
 * Ephemeral page state for the standalone baseplate page.
 *
 * Tracks WASM worker status, generation progress, and the current mesh result.
 * This store is NOT persisted - it resets when the page unmounts.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error';
type WasmStatus = 'unloaded' | 'loading' | 'ready' | 'error';

interface MeshResult {
  readonly vertices: Float32Array | null;
  readonly normals: Float32Array | null;
  readonly indices: Uint32Array | null;
  readonly edgeVertices: Float32Array | null;
  readonly error: string | null;
  readonly timingMs: number;
}

interface BaseplatePageState {
  generation: {
    status: GenerationStatus;
    mesh: MeshResult | null;
    epoch: number;
  };
  wasmStatus: WasmStatus;
  /** Slab offset for asymmetric padding — applied in Three.js, not BREP */
  slabOffset: { x: number; y: number };

  setGenerationStatus: (status: GenerationStatus) => void;
  setGenerationResult: (result: MeshResult) => void;
  setWasmStatus: (status: WasmStatus) => void;
  setSlabOffset: (x: number, y: number) => void;
  bumpEpoch: () => void;
}

export const useBaseplatePageStore = create<BaseplatePageState>()(
  immer((set) => ({
    generation: {
      status: 'idle',
      mesh: null,
      epoch: 0,
    },
    wasmStatus: 'unloaded',
    slabOffset: { x: 0, y: 0 },

    setGenerationStatus: (status) => {
      set((state) => {
        state.generation.status = status;
      });
    },

    setGenerationResult: (result) => {
      set((state) => {
        state.generation.mesh = result;
      });
    },

    setWasmStatus: (status) => {
      set((state) => {
        state.wasmStatus = status;
      });
    },

    setSlabOffset: (x, y) => {
      set((state) => {
        state.slabOffset.x = x;
        state.slabOffset.y = y;
      });
    },

    bumpEpoch: () => {
      set((state) => {
        state.generation.epoch += 1;
      });
    },
  }))
);
