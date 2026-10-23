/**
 * Surface-text actions: lid and floor text, per-wall text + alignment + shared style,
 * and the label-tab row texts. Each collapses the `surfaceText`/`label` config
 * back to absent when nothing remains so pre-feature designs serialize
 * byte-identically.
 */

import type {
  WallTextSide,
  WallTextFace,
  TextAnchor,
  TextQuarterTurn,
  TextStyleOverride,
} from '@/features/bin-designer/types';
import {
  TEXT_MAX_LENGTH,
  normalizeTextInput,
  topRowAnchor,
  wallTextFace,
} from '@/features/bin-designer/types/text';
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
      // Truncated to the SAME budget the server enforces, not merely checked
      // against it: an honest oversized paste has to arrive clamped rather than
      // coming back as a 400 the user cannot act on.
      const clamped = normalizeTextInput(text).trim();
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

    setFloorText: (text: string) => {
      const { params } = get();
      const clamped = normalizeTextInput(text).trim();
      if ((params.surfaceText?.floorText ?? '') === clamped) return;

      set((state) => {
        pushHistoryEntry(state);
        const { floorText: _drop, ...rest } = state.params.surfaceText ?? {};
        const next = {
          ...rest,
          ...(clamped !== '' ? { floorText: clamped } : {}),
        };
        state.params.surfaceText = Object.keys(next).length > 0 ? next : undefined;
      });
    },

    setFloorTextStyle: (overrides: TextStyleOverride | null) => {
      set((state) => {
        pushHistoryEntry(state);
        const { floorStyle: _drop, ...rest } = state.params.surfaceText ?? {};
        const next = {
          ...rest,
          ...(overrides !== null && Object.keys(overrides).length > 0
            ? { floorStyle: overrides }
            : {}),
        };
        state.params.surfaceText = Object.keys(next).length > 0 ? next : undefined;
      });
    },

    setFloorTextRotation: (rotation: TextQuarterTurn) => {
      const { params } = get();
      if ((params.surfaceText?.floorTextRotation ?? 0) === rotation) return;
      set((state) => {
        pushHistoryEntry(state);
        const { floorTextRotation: _drop, ...rest } = state.params.surfaceText ?? {};
        const next = {
          ...rest,
          ...(rotation !== 0 ? { floorTextRotation: rotation } : {}),
        };
        state.params.surfaceText = Object.keys(next).length > 0 ? next : undefined;
      });
    },

    setWallText: (side: WallTextSide, text: string) => {
      const { params } = get();
      // Trimmed on store, same rationale as setLidText: the worker trims
      // before generating, so outer whitespace would only create no-op
      // history entries and regenerations.
      const clamped = normalizeTextInput(text).trim();
      // No-op guard: same idle-flush + blur double-commit as setLidText.
      if ((params.surfaceText?.walls?.[side] ?? '') === clamped) return;

      set((state) => {
        pushHistoryEntry(state);
        const { walls: prevWalls, ...rest } = state.params.surfaceText ?? {};
        const { [side]: _drop, ...otherWalls } = prevWalls ?? {};
        const walls = {
          ...otherWalls,
          ...(clamped !== '' ? { [side]: clamped } : {}),
        };
        const hasWalls = Object.keys(walls).length > 0;
        const next = {
          ...rest,
          ...(hasWalls ? { walls } : {}),
        };
        state.params.surfaceText = Object.keys(next).length > 0 ? next : undefined;
      });
    },

    clearWallText: () => {
      const { params } = get();
      // No-op guard: nothing to clear keeps undo/regeneration quiet. Per-wall
      // styles count as something to clear, because a design can hold them
      // without any wall strings.
      const st = params.surfaceText;
      if (
        st?.walls === undefined &&
        st?.wallStyles === undefined &&
        st?.wallFaces === undefined &&
        st?.insideStyle === undefined
      ) {
        return;
      }

      set((state) => {
        pushHistoryEntry(state);
        // Drop `walls` AND everything that only refines them; keep any other
        // surface-text keys (lid text, shared style) intact.
        const {
          walls: _walls,
          wallStyles: _styles,
          wallFaces: _faces,
          insideStyle: _inside,
          ...rest
        } = state.params.surfaceText ?? {};
        state.params.surfaceText = Object.keys(rest).length > 0 ? rest : undefined;
      });
    },

    setWallTextFace: (side: WallTextSide, face: WallTextFace) => {
      const { params } = get();
      if (wallTextFace(params.surfaceText, side) === face) return;

      set((state) => {
        pushHistoryEntry(state);
        const {
          wallFaces: prevFaces,
          insideStyle: prevInside,
          ...rest
        } = state.params.surfaceText ?? {};
        const { [side]: _drop, ...otherFaces } = prevFaces ?? {};
        const wallFaces = { ...otherFaces, ...(face === 'inside' ? { [side]: face } : {}) };
        const anyInside = Object.keys(wallFaces).length > 0;
        // Inside text starts near the rim: anchored low, it sits by the floor
        // where whatever the bin holds covers it.
        const sharedAnchor = rest.style?.anchor ?? state.params.textDefaults.anchor;
        const insideStyle = anyInside
          ? prevInside?.anchor !== undefined
            ? prevInside
            : { ...prevInside, anchor: topRowAnchor(sharedAnchor) }
          : undefined;
        const next = {
          ...rest,
          ...(anyInside ? { wallFaces } : {}),
          ...(insideStyle !== undefined ? { insideStyle } : {}),
        };
        state.params.surfaceText = Object.keys(next).length > 0 ? next : undefined;
      });
    },

    setInsideTextAnchor: (anchor: TextAnchor) => {
      const { params } = get();
      const st = params.surfaceText;
      if (st?.wallFaces === undefined) return;
      const current = st.insideStyle?.anchor ?? st.style?.anchor ?? params.textDefaults.anchor;
      if (current === anchor) return;
      set((state) => {
        pushHistoryEntry(state);
        const rest = state.params.surfaceText ?? {};
        state.params.surfaceText = { ...rest, insideStyle: { ...rest.insideStyle, anchor } };
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

    /** Anchor for every surface, written onto the shared style. */
    setSurfaceTextAnchor: (anchor: TextAnchor) => {
      const { params } = get();
      const current = params.surfaceText?.style?.anchor ?? params.textDefaults.anchor;
      if (current === anchor) return;
      set((state) => {
        pushHistoryEntry(state);
        const rest = state.params.surfaceText ?? {};
        state.params.surfaceText = { ...rest, style: { ...rest.style, anchor } };
      });
    },

    setLidTextStyle: (overrides: TextStyleOverride | null) => {
      set((state) => {
        pushHistoryEntry(state);
        const { lidStyle: _drop, ...rest } = state.params.surfaceText ?? {};
        const next = {
          ...rest,
          ...(overrides !== null && Object.keys(overrides).length > 0
            ? { lidStyle: overrides }
            : {}),
        };
        state.params.surfaceText = Object.keys(next).length > 0 ? next : undefined;
      });
    },

    setLidTextRotation: (rotation: TextQuarterTurn) => {
      const { params } = get();
      if ((params.surfaceText?.lidTextRotation ?? 0) === rotation) return;
      set((state) => {
        pushHistoryEntry(state);
        const { lidTextRotation: _drop, ...rest } = state.params.surfaceText ?? {};
        const next = {
          ...rest,
          ...(rotation !== 0 ? { lidTextRotation: rotation } : {}),
        };
        state.params.surfaceText = Object.keys(next).length > 0 ? next : undefined;
      });
    },

    setWallTextStyle: (side: WallTextSide, overrides: TextStyleOverride | null) => {
      set((state) => {
        pushHistoryEntry(state);
        const { wallStyles: prev, ...rest } = state.params.surfaceText ?? {};
        const { [side]: _drop, ...others } = prev ?? {};
        const wallStyles = {
          ...others,
          ...(overrides !== null && Object.keys(overrides).length > 0 ? { [side]: overrides } : {}),
        };
        const next = {
          ...rest,
          ...(Object.keys(wallStyles).length > 0 ? { wallStyles } : {}),
        };
        state.params.surfaceText = Object.keys(next).length > 0 ? next : undefined;
      });
    },
  };
}
