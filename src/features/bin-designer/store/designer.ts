/**
 * Bin Designer Zustand store.
 *
 * Manages all designer state: bin parameters, generation status,
 * undo/redo history with mesh caching, and UI state.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { current, type Draft } from 'immer';
import type {
  DesignerState,
  BinParams,
  BaseConfig,
  LabelTabConfig,
  WallPatternConfig,
  Insert,
  ExportFileNameConfig,
  GenerationStatus,
  GenerationResult,
  WasmStatus,
  DesignerTab,
  SaveStatus,
  SavedDesign,
  HistoryEntry,
  CachedMesh,
} from '../types';
import { THUMBNAIL_VERSION } from '../types';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_GENERATION_STATE,
  DEFAULT_UI_STATE,
  DEFAULT_HISTORY,
  DESIGNER_CONSTRAINTS,
  migrateParams,
} from '../constants';
import { isErr } from '@/core/result';
import { DEFAULT_EXPORT_FILE_NAME_CONFIG } from '../utils/fileNaming';
import { isFractional } from '@/core/constants';
import { isRectangularSelection, normalizeIds } from '../utils/compartments';
import { validateCompartmentSizes } from '../utils/validation';
import { createCachedMesh, evictIfNeeded } from './meshCacheManager';

/**
 * Pending mesh cache: stores the mesh generated for the current params,
 * to be attached to the next history entry when params change.
 */
let pendingMeshCache: CachedMesh | null = null;

/**
 * Push current params (with pending mesh) to history past array.
 * Evicts old caches if memory budget exceeded.
 */
function pushHistoryEntry(state: Draft<DesignerState>): void {
  const entry: HistoryEntry = {
    params: current(state.params),
    mesh: pendingMeshCache,
  };
  state.history.past = [
    ...state.history.past.slice(-(DESIGNER_CONSTRAINTS.MAX_HISTORY - 1)),
    entry,
  ];
  state.history.future = [];
  state.generation.epoch += 1;

  // Evict old meshes if over memory budget
  const evicted = evictIfNeeded(state.history.past, state.history.future);
  state.history.past = evicted.past as HistoryEntry[];
  state.history.future = evicted.future as HistoryEntry[];

  // Clear cached mesh for the previous params; new params need a fresh result
  pendingMeshCache = null;
}

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
    exportFileNameConfig: { ...DEFAULT_EXPORT_FILE_NAME_CONFIG },
    pendingBinLink: null as string | null,
    needsThumbnailUpdate: false,

    // Param actions
    setParam: <K extends keyof BinParams>(key: K, value: BinParams[K]) => {
      // Guard compartment configuration changes against degenerate cell sizes
      if (key === 'compartments') {
        const { params } = get();
        const newCompartments = value as BinParams['compartments'];
        const result = validateCompartmentSizes(
          params.width,
          params.depth,
          params.wallThickness,
          newCompartments.cols,
          newCompartments.rows,
          newCompartments.thickness
        );
        if (isErr(result)) return;
      }

      set((state) => {
        pushHistoryEntry(state);
        state.params[key] = value;
      });
    },

    setParams: (partial: Partial<BinParams>) => {
      // Guard compartment configuration changes against degenerate cell sizes
      if (partial.compartments) {
        const { params } = get();
        const width = partial.width ?? params.width;
        const depth = partial.depth ?? params.depth;
        const wallThickness = partial.wallThickness ?? params.wallThickness;
        const result = validateCompartmentSizes(
          width,
          depth,
          wallThickness,
          partial.compartments.cols,
          partial.compartments.rows,
          partial.compartments.thickness
        );
        if (isErr(result)) return;
      }

      set((state) => {
        pushHistoryEntry(state);
        Object.assign(state.params, partial);
      });
    },

    resetToDefaults: () => {
      set((state) => {
        pushHistoryEntry(state);
        state.params = { ...DEFAULT_BIN_PARAMS };
      });
    },

    // Scoped updaters — merge partial into nested config
    updateBase: (partial: Partial<BaseConfig>) => {
      set((state) => {
        pushHistoryEntry(state);
        Object.assign(state.params.base, partial);
      });
    },

    updateLabel: (partial: Partial<LabelTabConfig>) => {
      set((state) => {
        pushHistoryEntry(state);
        Object.assign(state.params.label, partial);
      });
    },

    // Wall pattern actions
    updateWallPattern: (partial: Partial<WallPatternConfig>) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.wallPattern = { ...state.params.wallPattern, ...partial };
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

    setExportFileNameConfig: (config: ExportFileNameConfig) => {
      set((state) => {
        state.exportFileNameConfig = config;
      });
    },

    setPendingBinLink: (binId: string | null) => {
      set((state) => {
        state.pendingBinLink = binId;
      });
    },

    clearPendingBinLink: () => {
      set((state) => {
        state.pendingBinLink = null;
      });
    },

    setNeedsThumbnailUpdate: (needed: boolean) => {
      set((state) => {
        state.needsThumbnailUpdate = needed;
      });
    },

    newDesign: () => {
      set((state) => {
        state.history.past = [];
        state.history.future = [];
        state.params = { ...DEFAULT_BIN_PARAMS };
        state.currentDesignId = null;
        state.designName = 'Untitled Bin';
        state.saveStatus = 'idle';
        state.exportFileNameConfig = { ...DEFAULT_EXPORT_FILE_NAME_CONFIG };
        state.pendingBinLink = null;
        state.needsThumbnailUpdate = false;
        state.generation.epoch += 1;
        pendingMeshCache = null;
      });
    },

    loadDesign: (design: SavedDesign) => {
      // Check if thumbnail needs regeneration (missing or outdated version)
      const needsNewThumbnail =
        !design.thumbnail || (design.thumbnailVersion ?? 0) < THUMBNAIL_VERSION;

      set((state) => {
        state.params = migrateParams(design.params);
        state.currentDesignId = design.id;
        state.designName = design.name;
        state.exportFileNameConfig = design.exportFileNameConfig ?? {
          ...DEFAULT_EXPORT_FILE_NAME_CONFIG,
        };
        state.history = { past: [], future: [] };
        state.saveStatus = 'saved';
        state.pendingBinLink = null;
        state.needsThumbnailUpdate = needsNewThumbnail;
        state.generation.epoch += 1;
        pendingMeshCache = null;
      });
    },

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
          mesh: pendingMeshCache,
        };
        state.history.future = [currentEntry, ...state.history.future];

        // Restore params
        state.params = previous.params;

        if (previous.mesh) {
          // Cache hit: restore mesh directly, no regeneration needed
          state.generation.mesh = {
            vertices: previous.mesh.vertices,
            normals: previous.mesh.normals,
            error: null,
            timingMs: 0,
          };
          state.generation.status = 'complete';
          pendingMeshCache = previous.mesh;
          // epoch unchanged — no regeneration needed
        } else {
          // No cache: increment epoch to trigger regeneration
          state.generation.epoch += 1;
          pendingMeshCache = null;
        }
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
          mesh: pendingMeshCache,
        };
        state.history.past = [...state.history.past, currentEntry];

        // Restore params
        state.params = next.params;

        if (next.mesh) {
          // Cache hit: restore mesh directly
          state.generation.mesh = {
            vertices: next.mesh.vertices,
            normals: next.mesh.normals,
            error: null,
            timingMs: 0,
          };
          state.generation.status = 'complete';
          pendingMeshCache = next.mesh;
        } else {
          // No cache: trigger regeneration
          state.generation.epoch += 1;
          pendingMeshCache = null;
        }
      });
    },

    // Compartment actions
    setCompartmentGrid: (cols: number, rows: number) => {
      const { params } = get();
      const result = validateCompartmentSizes(
        params.width,
        params.depth,
        params.wallThickness,
        cols,
        rows,
        params.compartments.thickness
      );
      if (isErr(result)) return;

      set((state) => {
        pushHistoryEntry(state);
        const cells: number[] = [];
        for (let i = 0; i < rows * cols; i++) {
          cells.push(i);
        }
        state.params.compartments = {
          ...state.params.compartments,
          cols,
          rows,
          cells,
        };
      });
    },

    mergeCells: (cellIndices: readonly number[]) => {
      if (cellIndices.length < 2) return;
      const { params } = get();
      const { cols } = params.compartments;

      if (!isRectangularSelection(cols, cellIndices)) return;

      const existingIds = cellIndices.map((i) => params.compartments.cells[i]);
      const targetId = Math.min(...existingIds);

      set((state) => {
        pushHistoryEntry(state);
        const newCells = [...state.params.compartments.cells];
        for (const idx of cellIndices) {
          newCells[idx] = targetId;
        }
        state.params.compartments = {
          ...state.params.compartments,
          cells: normalizeIds(newCells),
        };
      });
    },

    splitCompartment: (compartmentId: number) => {
      const { params } = get();
      // Splitting produces individual cells — validate full grid is viable
      const result = validateCompartmentSizes(
        params.width,
        params.depth,
        params.wallThickness,
        params.compartments.cols,
        params.compartments.rows,
        params.compartments.thickness
      );
      if (isErr(result)) return;

      set((state) => {
        pushHistoryEntry(state);
        const newCells = [...state.params.compartments.cells];
        let nextId = Math.max(...newCells) + 1;
        let first = true;
        for (let i = 0; i < newCells.length; i++) {
          if (newCells[i] === compartmentId) {
            if (first) {
              first = false;
            } else {
              newCells[i] = nextId++;
            }
          }
        }
        state.params.compartments = {
          ...state.params.compartments,
          cells: normalizeIds(newCells),
        };
      });
    },

    resetCompartments: () => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.compartments = { ...DEFAULT_BIN_PARAMS.compartments };
      });
    },

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
      if (result.vertices && result.normals) {
        pendingMeshCache = createCachedMesh(
          result.vertices,
          result.normals,
          Math.floor(result.vertices.length / 9) // 3 vertices per triangle, 3 floats each
        );
      } else {
        pendingMeshCache = null;
      }
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

    setPreviewCompartments: (preview: BinParams['compartments'] | null) => {
      set((state) => {
        state.ui.previewCompartments = preview;
      });
    },

    setPreviewSelection: (
      selection: {
        action: 'merge' | 'split';
        minCol: number;
        maxCol: number;
        minRow: number;
        maxRow: number;
      } | null
    ) => {
      set((state) => {
        state.ui.previewSelection = selection;
      });
    },

    toggleHalfBinMode: () => {
      set((state) => {
        const enabling = !state.ui.halfBinMode;
        if (!enabling) {
          if (isFractional(state.params.width) || isFractional(state.params.depth)) {
            pushHistoryEntry(state);
          }
          if (isFractional(state.params.width)) {
            state.params.width = Math.round(state.params.width);
          }
          if (isFractional(state.params.depth)) {
            state.params.depth = Math.round(state.params.depth);
          }
        }
        state.ui.halfBinMode = enabling;
      });
    },
  }))
);

/**
 * Reset the pending mesh cache (used in tests).
 * @internal
 */
export function _resetPendingMeshCache(): void {
  pendingMeshCache = null;
}
