/**
 * Bento workspace actions: additive draw/move/resize/duplicate/remove over
 * the compartment grid, the off-grid stash, and the preserve-and-stash grid
 * resize. Thin wrappers over the pure ops in `utils/bentoDraw` — each
 * computes the result from the current snapshot, no-ops when the op reports
 * invalid, and commits with ONE history entry.
 *
 * Actions return the affected compartment's post-normalization ID (IDs
 * renumber on every mutation, gotcha #6) so the workspace can keep its
 * selection pointed at the right compartment.
 */

import {
  clearDrawnCompartments,
  drawCompartment,
  duplicateCompartment,
  moveCompartment,
  placeFromStash,
  removeCompartment,
  removeStashEntry,
  resizeCompartment,
  resizeGridPreservingCompartments,
  stashCompartment,
  type CellRect,
  type RegridResult,
} from '@/features/bin-designer/utils/bentoDraw';
import { validateCompartmentSizes } from '@/features/bin-designer/utils/validation';
import { isErr } from '@/core/result';
import { pushHistoryEntry } from '@/features/bin-designer/store/helpers';
import type { Set, Get } from './types';

export function createBentoActions(set: Set, get: Get) {
  return {
    drawBentoCompartment: (rect: CellRect): number | null => {
      const result = drawCompartment(get().params.compartments, rect);
      if (!result) return null;
      set((state) => {
        pushHistoryEntry(state);
        state.params.compartments = result.config;
      });
      return result.id;
    },

    moveBentoCompartment: (id: number, dCol: number, dRow: number): number | null => {
      const compartments = get().params.compartments;
      const result = moveCompartment(compartments, id, dCol, dRow);
      if (!result) return null;
      // A zero-cell move returns the input config unchanged — keep it a
      // true no-op so a click-without-drag doesn't push a history entry.
      if (result.config === compartments) return result.id;
      set((state) => {
        pushHistoryEntry(state);
        state.params.compartments = result.config;
      });
      return result.id;
    },

    resizeBentoCompartment: (id: number, target: CellRect): number | null => {
      const result = resizeCompartment(get().params.compartments, id, target);
      if (!result) return null;
      set((state) => {
        pushHistoryEntry(state);
        state.params.compartments = result.config;
      });
      return result.id;
    },

    duplicateBentoCompartment: (id: number, target: CellRect): number | null => {
      const result = duplicateCompartment(get().params.compartments, id, target);
      if (!result) return null;
      set((state) => {
        pushHistoryEntry(state);
        state.params.compartments = result.config;
      });
      return result.id;
    },

    removeBentoCompartment: (id: number): boolean => {
      const result = removeCompartment(get().params.compartments, id);
      if (!result) return false;
      set((state) => {
        pushHistoryEntry(state);
        state.params.compartments = result;
      });
      return true;
    },

    stashBentoCompartment: (id: number): boolean => {
      const result = stashCompartment(get().params.compartments, id);
      if (!result) return false;
      set((state) => {
        pushHistoryEntry(state);
        state.params.compartments = result;
      });
      return true;
    },

    placeBentoStashEntry: (index: number, rect: CellRect): number | null => {
      const result = placeFromStash(get().params.compartments, index, rect);
      if (!result) return null;
      set((state) => {
        pushHistoryEntry(state);
        state.params.compartments = result.config;
      });
      return result.id;
    },

    removeBentoStashEntry: (index: number): boolean => {
      const result = removeStashEntry(get().params.compartments, index);
      if (!result) return false;
      set((state) => {
        // Stash-only edit: the worker never reads the stash, so no epoch bump.
        pushHistoryEntry(state, { affectsGeometry: false });
        state.params.compartments = result;
      });
      return true;
    },

    /**
     * Bento-header grid resize: preserves drawn compartments, stashes the
     * displaced. Returns the counts for the toast, or null when the new
     * dimensions fail the min-compartment-size pre-flight (same guard as
     * `setCompartmentGrid`). The sidebar Grid Dividers editor keeps its
     * reset-to-uniform `setCompartmentGrid` — two surfaces, two intents.
     */
    setBentoGridPreserving: (
      cols: number,
      rows: number
    ): Pick<RegridResult, 'stashedCount' | 'droppedCount'> | null => {
      const { params } = get();
      if (cols === params.compartments.cols && rows === params.compartments.rows) {
        return { stashedCount: 0, droppedCount: 0 };
      }
      const sizeCheck = validateCompartmentSizes(
        params.width,
        params.depth,
        params.wallThickness,
        cols,
        rows,
        params.compartments.thickness,
        params.gridUnitMm,
        params.gridUnitMmY
      );
      if (isErr(sizeCheck)) return null;
      const result = resizeGridPreservingCompartments(params.compartments, cols, rows);
      set((state) => {
        pushHistoryEntry(state);
        state.params.compartments = result.config;
      });
      return { stashedCount: result.stashedCount, droppedCount: result.droppedCount };
    },

    clearBentoCompartments: (): void => {
      const compartments = get().params.compartments;
      const cleared = clearDrawnCompartments(compartments);
      if (
        cleared.cells.length === compartments.cells.length &&
        cleared.cells.every((id, i) => id === compartments.cells[i]) &&
        !compartments.compartmentTexts &&
        !compartments.labelPlateWidths &&
        !compartments.labelIcons &&
        !compartments.dividerOverrides &&
        !compartments.drawnUnitCells
      ) {
        return;
      }
      set((state) => {
        pushHistoryEntry(state);
        state.params.compartments = cleared;
      });
    },
  };
}
