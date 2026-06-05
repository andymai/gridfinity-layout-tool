/**
 * History slice: undo/redo, transactions, mesh cache coordination.
 */

import { current, type Draft } from 'immer';
import type {
  DesignerState,
  GenerationStatus,
  GenerationResult,
  WasmStatus,
  HistoryEntry,
} from '../../types';
import { PERF_HISTORY_LIMIT } from '../../types';
import type { PerfSnapshot, PerfStageEntry, PerfSubstepEntry } from '@/shared/types/generation';

/** Internal write-side mirror of PerfSnapshot used by the Immer reducer. */
interface MutablePerfSnapshot {
  totalMs: number;
  stages: PerfStageEntry[];
  featureBuilders: PerfSubstepEntry[];
  wallPatternSubsteps: PerfSubstepEntry[];
  hexCenterCount: number;
  patternCutToolCount: number;
}
import {
  pushHistoryEntry,
  restoreHistoryEntry,
  getPendingMeshCache,
  setPendingMeshCache,
} from '../helpers';
import { createCachedMesh } from '../meshCacheManager';

type Set = (fn: (state: Draft<DesignerState>) => void) => void;
type Get = () => DesignerState;

export function createHistorySlice(set: Set, get: Get) {
  return {
    // History actions
    pushHistory: () => {
      set((state) => {
        pushHistoryEntry(state);
      });
    },

    undo: () => {
      const { history } = get();
      if (history.past.length === 0) return;

      set((state) => {
        // Snapshot history as plain objects to avoid draft proxy revocation
        const historySnapshot = current(state.history);
        const previous = historySnapshot.past[historySnapshot.past.length - 1];
        state.history.past = historySnapshot.past.slice(0, -1);

        // Push current state (with pending mesh) to future
        const currentEntry: HistoryEntry = {
          params: current(state.params),
          mesh: getPendingMeshCache(),
        };
        state.history.future = [currentEntry, ...historySnapshot.future] as HistoryEntry[];

        restoreHistoryEntry(state, previous);
      });
    },

    redo: () => {
      const { history } = get();
      if (history.future.length === 0) return;

      set((state) => {
        // Snapshot history as plain objects to avoid draft proxy revocation
        const historySnapshot = current(state.history);
        const next = historySnapshot.future[0];
        state.history.future = historySnapshot.future.slice(1);

        // Push current state (with pending mesh) to past
        const currentEntry: HistoryEntry = {
          params: current(state.params),
          mesh: getPendingMeshCache(),
        };
        state.history.past = [...historySnapshot.past, currentEntry] as HistoryEntry[];

        restoreHistoryEntry(state, next);
      });
    },

    // Transaction support -- group multiple mutations into one undo step
    startTransaction: () => {
      set((state) => {
        if (state.transactionDepth === 0) {
          // Push history entry before any mutations (transactionDepth is still 0,
          // so pushHistoryEntry will execute normally rather than skipping)
          pushHistoryEntry(state);
        }
        state.transactionDepth += 1;
      });
    },

    commitTransaction: () => {
      set((state) => {
        if (state.transactionDepth > 0) {
          state.transactionDepth -= 1;
        }
      });
    },

    // Generation actions
    setGenerationStatus: (status: GenerationStatus) => {
      set((state) => {
        state.generation.status = status;
      });
    },

    setDraftResult: (result: GenerationResult) => {
      set((state) => {
        state.generation.mesh = result;
        state.generation.isDraft = true;
        // Status stays 'generating' — the exact result is still computing, so the
        // draft must NOT look terminal. Flows gated on 'complete' (thumbnail
        // capture, autosave, split preview) would otherwise fire on the coarse
        // draft; `setGenerationResult` sets the terminal status when exact lands.
      });
      // Drafts are mesh-approximate; never seed the undo/redo mesh cache with
      // them — history must hold exact geometry, which the exact result sets.
    },

    setGenerationResult: (result: GenerationResult) => {
      set((state) => {
        state.generation.mesh = result;
        state.generation.isDraft = false;
        state.generation.status = result.error ? 'error' : 'complete';
      });

      // Cache the mesh for the next history push
      if (result.vertices && result.normals && result.indices) {
        setPendingMeshCache(
          createCachedMesh(
            result.vertices,
            result.normals,
            result.indices,
            result.edgeVertices ?? new Float32Array(0),
            result.indices.length / 3
          )
        );
      } else {
        setPendingMeshCache(null);
      }
    },

    setWasmStatus: (status: WasmStatus) => {
      set((state) => {
        state.wasmStatus = status;
      });
    },

    pushPerfSnapshot: (snapshot: PerfSnapshot) => {
      set((state) => {
        // Immer's WritableDraft can't accept the worker payload directly
        // because PerfSnapshot has deeply-readonly arrays. Re-shape into
        // a writable mirror, then cast at the assignment edge — the
        // store type still presents perfHistory as readonly to readers.
        const mutable: MutablePerfSnapshot = {
          totalMs: snapshot.totalMs,
          stages: snapshot.stages.map((s) => ({ ...s })),
          featureBuilders: snapshot.featureBuilders.map((s) => ({ ...s })),
          wallPatternSubsteps: snapshot.wallPatternSubsteps.map((s) => ({ ...s })),
          hexCenterCount: snapshot.hexCenterCount,
          patternCutToolCount: snapshot.patternCutToolCount,
        };
        const prev = state.generation.perfHistory as readonly MutablePerfSnapshot[];
        const next = [...prev, mutable];
        const bounded =
          next.length > PERF_HISTORY_LIMIT ? next.slice(next.length - PERF_HISTORY_LIMIT) : next;
        (state.generation as { perfHistory: MutablePerfSnapshot[] }).perfHistory = bounded;
      });
    },

    clearPerfHistory: () => {
      set((state) => {
        (state.generation as { perfHistory: MutablePerfSnapshot[] }).perfHistory = [];
      });
    },
  };
}
