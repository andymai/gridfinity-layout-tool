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
        const previous = state.history.past[state.history.past.length - 1];
        state.history.past = state.history.past.slice(0, -1);

        // Push current state (with pending mesh) to future
        const currentEntry: HistoryEntry = {
          params: current(state.params),
          mesh: getPendingMeshCache(),
        };
        state.history.future = [currentEntry, ...state.history.future];

        restoreHistoryEntry(state, previous);
      });
    },

    redo: () => {
      const { history } = get();
      if (history.future.length === 0) return;

      set((state) => {
        const next = state.history.future[0];
        state.history.future = state.history.future.slice(1);

        // Push current state (with pending mesh) to past
        const currentEntry: HistoryEntry = {
          params: current(state.params),
          mesh: getPendingMeshCache(),
        };
        state.history.past = [...state.history.past, currentEntry];

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

    setGenerationResult: (result: GenerationResult) => {
      set((state) => {
        state.generation.mesh = result;
        state.generation.status = result.error ? 'error' : 'complete';
      });

      // Cache the mesh for the next history push
      if (result.vertices && result.normals && result.indices) {
        setPendingMeshCache(
          createCachedMesh(
            result.vertices,
            result.normals,
            result.indices,
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
  };
}
