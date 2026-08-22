/**
 * Core bin-param actions: whole-`params` writes, reset-to-defaults, and the
 * custom-shape `cellMask`. Owns `reshapeOrClearMask`, shared by every path
 * that changes the footprint.
 */

import type { BinParams } from '@/features/bin-designer/types';
import { isErr } from '@/core/result';
import { validateCompartmentSizes } from '@/features/bin-designer/utils/validation';
import {
  applyCutoutFillAnchor,
  captureCutoutFill,
  defaultsForNewDesign,
  paramsNeedHalfGridMode,
  pushHistoryEntry,
} from '@/features/bin-designer/store/helpers';
import {
  MASK_CELLS_PER_UNIT,
  type CellMask,
  resizeMask,
  isAllFilled,
  validateMask,
} from '@/shared/utils/cellMask';
import type { Set, Get } from './types';

export function createCoreParamActions(set: Set, get: Get) {
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
          newCompartments.thickness,
          params.gridUnitMm,
          params.gridUnitMmY
        );
        if (isErr(result)) return;
      }

      set((state) => {
        pushHistoryEntry(state);
        const heldFill = captureCutoutFill(state);
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
        applyCutoutFillAnchor(state, heldFill);
      });
    },

    setParams: (partial: Partial<BinParams>) => {
      // Guard compartment configuration changes against degenerate cell sizes
      if (partial.compartments) {
        const { params } = get();
        const width = partial.width ?? params.width;
        const depth = partial.depth ?? params.depth;
        const wallThickness = partial.wallThickness ?? params.wallThickness;
        const gridUnitMm = partial.gridUnitMm ?? params.gridUnitMm;
        const gridUnitMmY = partial.gridUnitMmY ?? params.gridUnitMmY;
        const result = validateCompartmentSizes(
          width,
          depth,
          wallThickness,
          partial.compartments.cols,
          partial.compartments.rows,
          partial.compartments.thickness,
          gridUnitMm,
          gridUnitMmY
        );
        if (isErr(result)) return;
      }

      set((state) => {
        pushHistoryEntry(state);
        const heldFill = captureCutoutFill(state);
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
        applyCutoutFillAnchor(state, heldFill);
      });
    },

    resetToDefaults: () => {
      set((state) => {
        pushHistoryEntry(state);
        state.params = { ...defaultsForNewDesign() };
        // Keep UI toggles in sync with the resolved params: a custom default
        // may carry fractional dimensions (→ half-grid mode), and defaults
        // always strip `cellMask` (→ shape editor closed). Without this the
        // toggles would leak the previous design's state.
        state.ui.halfGridMode = paramsNeedHalfGridMode(state.params);
        state.ui.shapeEditorOpen = false;
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
