/**
 * Surface-text actions: lid text, per-wall text + alignment + shared style,
 * and the label-tab row texts. Each collapses the `surfaceText`/`label` config
 * back to absent when nothing remains so pre-feature designs serialize
 * byte-identically.
 */

import type {
  WallTextSide,
  WallTextVerticalAlign,
  TextStyleOverride,
} from '@/features/bin-designer/types';
import { TEXT_MAX_LENGTH } from '@/features/bin-designer/types/text';
import { pushHistoryEntry } from '@/features/bin-designer/store/helpers';
import type { Set, Get } from './types';

export function createSurfaceTextActions(set: Set, get: Get) {
  return {
    setLabelRowText: (row: number, text: string) => {
      const { params } = get();
      const clamped = text.slice(0, TEXT_MAX_LENGTH);
      const prev = params.label.rowTexts ?? [];
      // Same idle+blur double-commit guard as setCompartmentText.
      if ((prev[row] ?? '') === clamped) return;

      set((state) => {
        pushHistoryEntry(state);
        const next = prev.slice();
        while (next.length <= row) next.push('');
        next[row] = clamped;
        while (next.length > 0 && next[next.length - 1] === '') next.pop();
        state.params.label = {
          ...state.params.label,
          ...(next.length > 0 ? { rowTexts: next } : { rowTexts: undefined }),
        };
      });
    },

    setLidText: (text: string) => {
      const { params } = get();
      // Trimmed on store: the worker trims before generating, so persisting
      // outer whitespace would only create no-op history entries and
      // regenerations for geometry that can't change.
      const clamped = text.slice(0, TEXT_MAX_LENGTH).trim();
      // No-op guard: the input commits on both idle and blur; an unchanged
      // value must not push a history entry or regeneration.
      if ((params.surfaceText?.lidText ?? '') === clamped) return;

      set((state) => {
        pushHistoryEntry(state);
        const { lidText: _drop, ...rest } = state.params.surfaceText ?? {};
        const next = {
          ...rest,
          ...(clamped !== '' ? { lidText: clamped } : {}),
        };
        // Drop the whole key when nothing remains so pre-feature designs
        // (and cleared text) serialize byte-identically.
        state.params.surfaceText = Object.keys(next).length > 0 ? next : undefined;
      });
    },

    setWallText: (side: WallTextSide, text: string) => {
      const { params } = get();
      // Trimmed on store, same rationale as setLidText: the worker trims
      // before generating, so outer whitespace would only create no-op
      // history entries and regenerations.
      const clamped = text.slice(0, TEXT_MAX_LENGTH).trim();
      // No-op guard: same idle-flush + blur double-commit as setLidText.
      if ((params.surfaceText?.walls?.[side] ?? '') === clamped) return;

      set((state) => {
        pushHistoryEntry(state);
        const { walls: prevWalls, wallAlign, ...rest } = state.params.surfaceText ?? {};
        const { [side]: _drop, ...otherWalls } = prevWalls ?? {};
        const walls = {
          ...otherWalls,
          ...(clamped !== '' ? { [side]: clamped } : {}),
        };
        const hasWalls = Object.keys(walls).length > 0;
        const next = {
          ...rest,
          ...(hasWalls ? { walls } : {}),
          // Alignment is meaningless without wall text — drop it with the
          // last wall string so the config can collapse to absent.
          ...(hasWalls && wallAlign !== undefined ? { wallAlign } : {}),
        };
        state.params.surfaceText = Object.keys(next).length > 0 ? next : undefined;
      });
    },

    clearWallText: () => {
      const { params } = get();
      // No-op guard: nothing to clear keeps undo/regeneration quiet. Checks
      // `wallAlign` too — a programmatic/legacy state can hold an alignment
      // without any wall strings, and clearing must still drop it.
      if (params.surfaceText?.walls === undefined && params.surfaceText?.wallAlign === undefined) {
        return;
      }

      set((state) => {
        pushHistoryEntry(state);
        // Drop `walls` AND `wallAlign` (meaningless without wall text); keep any
        // other surface-text keys (lid text, shared style) intact.
        const { walls: _walls, wallAlign: _align, ...rest } = state.params.surfaceText ?? {};
        state.params.surfaceText = Object.keys(rest).length > 0 ? rest : undefined;
      });
    },

    setWallTextAlign: (align: WallTextVerticalAlign) => {
      const { params } = get();
      // 'center' is the implicit default — stored as an absent field.
      const normalized = align === 'center' ? undefined : align;
      if ((params.surfaceText?.wallAlign ?? undefined) === normalized) return;

      set((state) => {
        pushHistoryEntry(state);
        const { wallAlign: _drop, ...rest } = state.params.surfaceText ?? {};
        const next = {
          ...rest,
          ...(normalized !== undefined ? { wallAlign: normalized } : {}),
        };
        state.params.surfaceText = Object.keys(next).length > 0 ? next : undefined;
      });
    },

    setSurfaceTextStyle: (overrides: TextStyleOverride | null) => {
      set((state) => {
        pushHistoryEntry(state);
        const { style: _drop, ...rest } = state.params.surfaceText ?? {};
        const next = {
          ...rest,
          ...(overrides !== null && Object.keys(overrides).length > 0 ? { style: overrides } : {}),
        };
        state.params.surfaceText = Object.keys(next).length > 0 ? next : undefined;
      });
    },
  };
}
