/**
 * Compartment actions: grid resize, merge/split, per-compartment labels,
 * plate widths/icons, divider height, and divider overrides.
 */

import type { LabelPlateIconId } from '@/shared/constants/labelPlates';
import { TEXT_MAX_LENGTH } from '@/features/bin-designer/types/text';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { isErr } from '@/core/result';
import { getFeatureStatus } from '@/shared/constraints';
import {
  carryCompartmentTextsByPosition,
  isRectangularSelection,
  mergeCells,
  splitCompartment,
} from '@/features/bin-designer/utils/compartments';
import { validateCompartmentSizes } from '@/features/bin-designer/utils/validation';
import { pushHistoryEntry } from '@/features/bin-designer/store/helpers';
import type { Set, Get } from './types';

export function createCompartmentActions(set: Set, get: Get) {
  return {
    // Compartment actions
    setCompartmentGrid: (cols: number, rows: number): number => {
      const { params } = get();
      const result = validateCompartmentSizes(
        params.width,
        params.depth,
        params.wallThickness,
        cols,
        rows,
        params.compartments.thickness,
        params.gridUnitMm,
        params.gridUnitMmY
      );
      if (isErr(result)) return 0;

      // Best-effort carry of labels by position; the rest are counted so the
      // UI can warn instead of dropping them silently (#2337).
      const carried = carryCompartmentTextsByPosition(params.compartments, cols, rows);
      const hasCarried = carried.texts.some((text) => text.length > 0);

      set((state) => {
        pushHistoryEntry(state);
        const cells = Array.from({ length: rows * cols }, (_, i) => i);
        // Divider overrides key on adjacencies the fresh uniform grid no longer
        // has — drop them. Labels carry by position above where they fit.
        // Plate-width overrides drop too: the fresh grid's compartment sizes
        // invalidate the old choices, and auto re-fits per compartment.
        const {
          compartmentTexts: _t,
          labelPlateWidths: _w,
          labelIcons: _i,
          dividerOverrides: _o,
          ...keep
        } = state.params.compartments;
        state.params.compartments = {
          ...keep,
          cols,
          rows,
          cells,
          ...(hasCarried ? { compartmentTexts: carried.texts } : {}),
        };
      });
      return carried.droppedCount;
    },

    mergeCells: (cellIndices: readonly number[]) => {
      if (cellIndices.length < 2) return;
      const { params } = get();
      const { cols } = params.compartments;

      // Guard before the history entry so a non-rectangular selection (which the
      // canonical mergeCells rejects with null) stays a true no-op.
      if (!isRectangularSelection(cols, cellIndices)) return;

      set((state) => {
        pushHistoryEntry(state);
        state.params.compartments =
          mergeCells(state.params.compartments, cellIndices) ?? state.params.compartments;
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
        params.compartments.thickness,
        params.gridUnitMm,
        params.gridUnitMmY
      );
      if (isErr(result)) return;

      set((state) => {
        pushHistoryEntry(state);
        state.params.compartments = splitCompartment(state.params.compartments, compartmentId);
      });
    },

    resetCompartments: () => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.compartments = { ...DEFAULT_BIN_PARAMS.compartments };
      });
    },

    setCompartmentText: (compartmentId: number, text: string) => {
      const { params } = get();
      const clamped = text.slice(0, TEXT_MAX_LENGTH);
      const prev = params.compartments.compartmentTexts ?? [];
      // No-op guard: the input commits on both idle and blur (see
      // CompartmentTextInput), so an idle-flushed value followed by a blur must
      // not push a second, identical history entry / regeneration.
      if ((prev[compartmentId] ?? '') === clamped) return;

      // A caption is only ever printed by a label tab (`labelTabPlan` returns
      // nothing while `label.enabled` is false), so writing one with tabs off
      // stored text that could never become geometry — the Bento dock's label
      // field looked broken for exactly this reason. Enabling comes in the SAME
      // history entry: two writes would cost two undos to get back. Never turn
      // it on where the constraint engine has ruled label tabs out (slotted,
      // spacer) — that would be a state the panel refuses to show.
      const turnTabsOn =
        clamped !== '' && !params.label.enabled && getFeatureStatus(params, 'label').available;

      set((state) => {
        pushHistoryEntry(state);
        const next = prev.slice();
        while (next.length <= compartmentId) next.push('');
        next[compartmentId] = clamped;
        while (next.length > 0 && next[next.length - 1] === '') next.pop();
        state.params.compartments = {
          ...state.params.compartments,
          ...(next.length > 0 ? { compartmentTexts: next } : { compartmentTexts: undefined }),
        };
        if (turnTabsOn) state.params.label = { ...state.params.label, enabled: true };
      });
    },

    clearLabelText: (scope: 'compartment' | 'row') => {
      const { params } = get();
      const isRow = scope === 'row';
      if (
        isRow ? (params.label.rowTexts ?? []).length === 0 : !params.compartments.compartmentTexts
      )
        return;

      // One entry for the whole clear, so a single undo brings every caption
      // back — clearing row by row would bury the list under N history steps.
      set((state) => {
        pushHistoryEntry(state);
        if (isRow) {
          const { rowTexts: _drop, ...label } = state.params.label;
          state.params.label = label;
        } else {
          state.params.compartments = {
            ...state.params.compartments,
            compartmentTexts: undefined,
          };
        }
      });
    },

    setCompartmentPlateWidth: (compartmentId: number, widthU: number | null) => {
      const { params } = get();
      const prev = params.compartments.labelPlateWidths ?? [];
      // No-op guard: an unchanged value must not push a history entry or
      // regeneration. A padded explicit null and an absent slot are the same
      // auto state, so compare through the ?? null lens.
      if ((prev[compartmentId] ?? null) === widthU) return;

      set((state) => {
        pushHistoryEntry(state);
        const next = prev.slice();
        while (next.length <= compartmentId) next.push(null);
        next[compartmentId] = widthU;
        while (next.length > 0 && next[next.length - 1] === null) next.pop();
        state.params.compartments = {
          ...state.params.compartments,
          // Reset to undefined when every entry is auto — dropped from
          // persisted JSON on stringify (same convention as compartmentTexts).
          labelPlateWidths: next.length > 0 ? next : undefined,
        };
      });
    },

    setCompartmentPlateIcon: (compartmentId: number, icon: LabelPlateIconId | null) => {
      const { params } = get();
      const prev = params.compartments.labelIcons ?? [];
      // No-op guard mirrors setCompartmentPlateWidth: unchanged values must
      // not push history or trigger regeneration.
      if ((prev[compartmentId] ?? null) === icon) return;

      set((state) => {
        pushHistoryEntry(state, { affectsGeometry: false });
        const next = prev.slice();
        while (next.length <= compartmentId) next.push(null);
        next[compartmentId] = icon;
        while (next.length > 0 && next[next.length - 1] === null) next.pop();
        state.params.compartments = {
          ...state.params.compartments,
          // Reset to undefined when no compartment carries an icon — dropped
          // from persisted JSON on stringify (same convention as
          // compartmentTexts).
          labelIcons: next.length > 0 ? next : undefined,
        };
      });
    },

    setCompartmentDividerHeight: (height: number | 'auto') => {
      const { params } = get();
      const prev = params.compartments.dividerHeight;
      // No-op guard: the stepper fires on every tick; an unchanged value must
      // not push a history entry. Treat undefined and 'auto' as the same state.
      const prevIsAuto = prev === undefined || prev === 'auto';
      if (height === 'auto' ? prevIsAuto : prev === height) return;

      set((state) => {
        pushHistoryEntry(state);
        if (height === 'auto') {
          // Omit the field entirely so persisted JSON stays tidy and the bin
          // shares the full-height cache bucket / cut-path geometry.
          const { dividerHeight: _drop, ...rest } = state.params.compartments;
          state.params.compartments = rest;
        } else {
          state.params.compartments = { ...state.params.compartments, dividerHeight: height };
        }
      });
    },

    setDividerOverride: (
      compartmentA: number,
      compartmentB: number,
      offsetStart: number,
      offsetEnd: number
    ) => {
      // Enforce canonical pair ordering: the validator + worker lookup all
      // assume compartmentA < compartmentB, and silently allowing unordered
      // pairs at the store would let two storage representations of the
      // same divider exist as separate entries.
      const [a, b] =
        compartmentA < compartmentB ? [compartmentA, compartmentB] : [compartmentB, compartmentA];
      const { params } = get();
      const prev = params.compartments.dividerOverrides ?? [];
      const existing = prev.find((o) => o.compartmentA === a && o.compartmentB === b);
      // No-op guard: dragging an endpoint to its current position fires this
      // action; an unchanged value would otherwise push a history entry per
      // pointer move and bloat the undo stack.
      if (existing && existing.offsetStart === offsetStart && existing.offsetEnd === offsetEnd) {
        return;
      }
      set((state) => {
        pushHistoryEntry(state);
        const next = prev.filter((o) => !(o.compartmentA === a && o.compartmentB === b));
        // Treat zero offsets as "remove" so the storage stays tidy and the
        // empty array can be omitted from persisted JSON.
        if (offsetStart !== 0 || offsetEnd !== 0) {
          next.push({ compartmentA: a, compartmentB: b, offsetStart, offsetEnd });
        }
        state.params.compartments = {
          ...state.params.compartments,
          ...(next.length > 0 ? { dividerOverrides: next } : { dividerOverrides: undefined }),
        };
      });
    },

    removeDividerOverride: (compartmentA: number, compartmentB: number) => {
      const [a, b] =
        compartmentA < compartmentB ? [compartmentA, compartmentB] : [compartmentB, compartmentA];
      const { params } = get();
      const prev = params.compartments.dividerOverrides ?? [];
      const next = prev.filter((o) => !(o.compartmentA === a && o.compartmentB === b));
      if (next.length === prev.length) return; // nothing changed
      set((state) => {
        pushHistoryEntry(state);
        state.params.compartments = {
          ...state.params.compartments,
          ...(next.length > 0 ? { dividerOverrides: next } : { dividerOverrides: undefined }),
        };
      });
    },

    clearDividerOverrides: () => {
      const { params } = get();
      if (!params.compartments.dividerOverrides?.length) return;
      set((state) => {
        pushHistoryEntry(state);
        const { dividerOverrides: _drop, ...rest } = state.params.compartments;
        state.params.compartments = rest;
      });
    },
  };
}
