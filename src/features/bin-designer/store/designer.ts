/**
 * Bin Designer Zustand store.
 *
 * Manages all designer state: bin parameters, generation status,
 * undo/redo history, and UI state.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { current } from 'immer';
import type {
  DesignerState,
  BinParams,
  Insert,
  GenerationStatus,
  GenerationResult,
  WasmStatus,
  DesignerTab,
  SaveStatus,
  SavedDesign,
} from '../types';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_GENERATION_STATE,
  DEFAULT_UI_STATE,
  DEFAULT_HISTORY,
  DESIGNER_CONSTRAINTS,
  migrateParams,
} from '../constants';

export const useDesignerStore = create<DesignerState>()(
  immer((set, get) => ({
    // Initial state
    params: { ...DEFAULT_BIN_PARAMS },
    generation: { ...DEFAULT_GENERATION_STATE },
    history: { ...DEFAULT_HISTORY },
    wasmStatus: 'unloaded' as WasmStatus,
    ui: { ...DEFAULT_UI_STATE },

    // Persistence state
    currentDesignId: null as string | null,
    designName: 'Untitled Bin',
    saveStatus: 'idle' as SaveStatus,

    // Param actions
    setParam: <K extends keyof BinParams>(key: K, value: BinParams[K]) => {
      set((state) => {
        // Push current params to history before modifying (deep snapshot via current())
        state.history.past = [
          ...state.history.past.slice(-(DESIGNER_CONSTRAINTS.MAX_HISTORY - 1)),
          current(state.params),
        ];
        state.history.future = [];
        state.params[key] = value;
      });
    },

    setParams: (partial: Partial<BinParams>) => {
      set((state) => {
        state.history.past = [
          ...state.history.past.slice(-(DESIGNER_CONSTRAINTS.MAX_HISTORY - 1)),
          current(state.params),
        ];
        state.history.future = [];
        Object.assign(state.params, partial);
      });
    },

    resetToDefaults: () => {
      set((state) => {
        state.history.past = [
          ...state.history.past.slice(-(DESIGNER_CONSTRAINTS.MAX_HISTORY - 1)),
          current(state.params),
        ];
        state.history.future = [];
        state.params = { ...DEFAULT_BIN_PARAMS };
      });
    },

    // Persistence actions
    setCurrentDesignId: (id: string | null) => {
      set((state) => {
        state.currentDesignId = id;
      });
    },

    setDesignName: (name: string) => {
      set((state) => {
        state.designName = name;
      });
    },

    setSaveStatus: (status: SaveStatus) => {
      set((state) => {
        state.saveStatus = status;
      });
    },

    newDesign: () => {
      set((state) => {
        // Clear history — undoing to a previous design's params
        // while in a new design context is semantically incorrect
        state.history.past = [];
        state.history.future = [];
        state.params = { ...DEFAULT_BIN_PARAMS };
        state.currentDesignId = null;
        state.designName = 'Untitled Bin';
        state.saveStatus = 'idle';
      });
    },

    loadDesign: (design: SavedDesign) => {
      set((state) => {
        state.params = migrateParams(design.params);
        state.currentDesignId = design.id;
        state.designName = design.name;
        state.history = { past: [], future: [] };
        state.saveStatus = 'saved';
      });
    },

    // History actions
    pushHistory: () => {
      set((state) => {
        state.history.past = [
          ...state.history.past.slice(-(DESIGNER_CONSTRAINTS.MAX_HISTORY - 1)),
          current(state.params),
        ];
        state.history.future = [];
      });
    },

    undo: () => {
      const { history } = get();
      if (history.past.length === 0) return;

      set((state) => {
        const previous = state.history.past[state.history.past.length - 1];
        state.history.past = state.history.past.slice(0, -1);
        state.history.future = [current(state.params), ...state.history.future];
        state.params = previous;
      });
    },

    redo: () => {
      const { history } = get();
      if (history.future.length === 0) return;

      set((state) => {
        const next = state.history.future[0];
        state.history.future = state.history.future.slice(1);
        state.history.past = [...state.history.past, current(state.params)];
        state.params = next;
      });
    },

    // Insert actions
    addInsert: (insert: Insert) => {
      set((state) => {
        state.history.past = [
          ...state.history.past.slice(-(DESIGNER_CONSTRAINTS.MAX_HISTORY - 1)),
          current(state.params),
        ];
        state.history.future = [];
        state.params.inserts = [...state.params.inserts, insert];
      });
    },

    removeInsert: (id: string) => {
      set((state) => {
        state.history.past = [
          ...state.history.past.slice(-(DESIGNER_CONSTRAINTS.MAX_HISTORY - 1)),
          current(state.params),
        ];
        state.history.future = [];
        state.params.inserts = state.params.inserts.filter((i) => i.id !== id);
      });
    },

    updateInsert: (id: string, updates: Partial<Insert>) => {
      set((state) => {
        state.history.past = [
          ...state.history.past.slice(-(DESIGNER_CONSTRAINTS.MAX_HISTORY - 1)),
          current(state.params),
        ];
        state.history.future = [];
        state.params.inserts = state.params.inserts.map((i) =>
          i.id === id ? { ...i, ...updates } : i
        );
      });
    },

    clearInserts: () => {
      set((state) => {
        state.history.past = [
          ...state.history.past.slice(-(DESIGNER_CONSTRAINTS.MAX_HISTORY - 1)),
          current(state.params),
        ];
        state.history.future = [];
        state.params.inserts = [];
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
    },

    setWasmStatus: (status: WasmStatus) => {
      set((state) => {
        state.wasmStatus = status;
      });
    },

    // UI actions
    setActiveTab: (tab: DesignerTab) => {
      set((state) => {
        state.ui.activeTab = tab;
      });
    },

    setExportDialogOpen: (open: boolean) => {
      set((state) => {
        state.ui.exportDialogOpen = open;
      });
    },

    setDesignListOpen: (open: boolean) => {
      set((state) => {
        state.ui.designListOpen = open;
      });
    },

    setWireframeMode: (enabled: boolean) => {
      set((state) => {
        state.ui.wireframeMode = enabled;
      });
    },
  }))
);
