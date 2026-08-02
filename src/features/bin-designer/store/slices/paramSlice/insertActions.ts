/**
 * Insert actions: add, remove, update, and clear the bin's inserts.
 */

import type { Insert } from '@/features/bin-designer/types';
import { pushHistoryEntry } from '@/features/bin-designer/store/helpers';
import type { Set } from './types';

export function createInsertActions(set: Set) {
  return {
    // Insert actions
    addInsert: (insert: Insert) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.inserts = [...state.params.inserts, insert];
      });
    },

    removeInsert: (id: string) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.inserts = state.params.inserts.filter((i) => i.id !== id);
      });
    },

    updateInsert: (id: string, updates: Partial<Insert>) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.inserts = state.params.inserts.map((i) =>
          i.id === id ? { ...i, ...updates } : i
        );
      });
    },

    clearInserts: () => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.inserts = [];
      });
    },
  };
}
