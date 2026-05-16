/**
 * Param slice: bin parameters, scoped updaters, compartments, inserts, wall pattern.
 */

import type { Draft } from 'immer';
import type {
  DesignerState,
  BinParams,
  BaseConfig,
  LabelTabConfig,
  ScoopConfig,
  WallConfig,
  WallCutout,
  WallSide,
  WallPatternConfig,
  CutoutConfig,
  Insert,
  HandleConfig,
  HandleSide,
  HandleWallSide,
  LidConfig,
} from '../../types';
import type { LipColorConfig } from '../../types/featureColors';
import { DEFAULT_BIN_PARAMS } from '../../constants';
import { isErr } from '@/core/result';
import { isRectangularSelection, normalizeIds } from '../../utils/compartments';
import { validateCompartmentSizes } from '../../utils/validation';
import { pushHistoryEntry } from '../helpers';
import {
  MASK_CELLS_PER_UNIT,
  type CellMask,
  resizeMask,
  isAllFilled,
  validateMask,
} from '@/shared/utils/cellMask';

type Set = (fn: (state: Draft<DesignerState>) => void) => void;
type Get = () => DesignerState;

export function createParamSlice(set: Set, get: Get) {
  return {
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
        // When the bin footprint grows or shrinks, keep a custom shape mask
        // aligned to the new dimensions. New cells default to filled so a
        // resize never silently erases the user's existing shape.
        if ((key === 'width' || key === 'depth') && state.params.cellMask) {
          state.params.cellMask = reshapeOrClearMask(
            state.params.cellMask,
            state.params.width,
            state.params.depth
          );
        }
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
        // Keep cellMask aligned with the resulting width/depth. Matters for
        // the dimension-swap button and share-load, both of which route
        // through setParams without going via setParam('width'|'depth').
        if (state.params.cellMask) {
          state.params.cellMask = reshapeOrClearMask(
            state.params.cellMask,
            state.params.width,
            state.params.depth
          );
        }
      });
    },

    resetToDefaults: () => {
      set((state) => {
        pushHistoryEntry(state);
        state.params = { ...DEFAULT_BIN_PARAMS };
      });
    },

    // Scoped updaters -- merge partial into nested config
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

    updateScoop: (partial: Partial<ScoopConfig>) => {
      set((state) => {
        pushHistoryEntry(state);
        Object.assign(state.params.scoop, partial);
      });
    },

    updateWalls: (partial: Partial<WallConfig>) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.walls = { ...state.params.walls, ...partial };
      });
    },

    updateWallSide: (side: WallSide, partial: Partial<WallCutout>) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.walls = {
          ...state.params.walls,
          [side]: { ...state.params.walls[side], ...partial },
        };
      });
    },

    updateHandles: (partial: Partial<HandleConfig>) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.handles = { ...state.params.handles, ...partial };
      });
    },

    updateHandleSide: (side: HandleWallSide, partial: Partial<HandleSide>) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.handles = {
          ...state.params.handles,
          [side]: { ...state.params.handles[side], ...partial },
        };
      });
    },

    // Wall pattern actions
    updateWallPattern: (partial: Partial<WallPatternConfig>) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.wallPattern = { ...state.params.wallPattern, ...partial };
      });
    },

    // Feature color actions
    updateFeatureColors: (patch: {
      body?: string;
      lip?: Partial<LipColorConfig>;
      labelTab?: string;
      base?: string;
      scoop?: string;
      dividers?: string;
    }) => {
      set((state) => {
        pushHistoryEntry(state);
        const current = state.params.featureColors;
        const { lip: lipPatch, ...rest } = patch;
        const nextLip: LipColorConfig = lipPatch ? { ...current.lip, ...lipPatch } : current.lip;
        state.params.featureColors = {
          ...current,
          ...rest,
          lip: nextLip,
        };
      });
    },

    // Click-lock lid actions
    updateLid: (partial: Partial<LidConfig>) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.lid = { ...state.params.lid, ...partial };
      });
    },

    // Cutout configuration actions
    updateCutoutConfig: (partial: Partial<CutoutConfig>) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.cutoutConfig = { ...state.params.cutoutConfig, ...partial };
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
      // Splitting produces individual cells -- validate full grid is viable
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

    // Custom bin shape (cellMask). Setting undefined or a fully-filled mask
    // routes the generator through the rectangle fast-path. Partial masks
    // produce a polygon footprint. Rejects masks that fail structural
    // validation (empty / disconnected / holes) or whose dimensions don't
    // match the current width/depth at half-bin resolution — a mismatched
    // mask would otherwise trip assertValidMask in the generator.
    setCellMask: (mask: CellMask | undefined) => {
      let next: CellMask | undefined;
      if (mask === undefined || isAllFilled(mask)) {
        next = undefined;
      } else {
        const { width, depth } = get().params;
        if (mask.cols !== Math.round(width * MASK_CELLS_PER_UNIT)) return;
        if (mask.rows !== Math.round(depth * MASK_CELLS_PER_UNIT)) return;
        if (validateMask(mask) !== null) return;
        next = mask;
      }
      set((state) => {
        pushHistoryEntry(state);
        state.params.cellMask = next;
      });
    },
  };
}

/**
 * Resize a cellMask to match new `width × depth` (in grid units). If the
 * resized mask turns out to be structurally invalid (very rare — the caller
 * changed dimensions in a way that disconnects the shape) or if it now
 * covers the full footprint, return `undefined` so the generator drops back
 * to the rectangle fast-path.
 */
function reshapeOrClearMask(
  mask: CellMask,
  widthUnits: number,
  depthUnits: number
): CellMask | undefined {
  const cols = Math.round(widthUnits * MASK_CELLS_PER_UNIT);
  const rows = Math.round(depthUnits * MASK_CELLS_PER_UNIT);
  if (mask.cols === cols && mask.rows === rows) return mask;
  const resized = resizeMask(mask, cols, rows);
  if (isAllFilled(resized)) return undefined;
  if (validateMask(resized) !== null) return undefined;
  return resized;
}
