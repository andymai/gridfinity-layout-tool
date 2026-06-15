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
  OverhangConfig,
  WallCutout,
  WallSide,
  WallPatternConfig,
  CutoutConfig,
  Insert,
  HandleConfig,
  HandleSide,
  HandleWallSide,
  LidConfig,
  TextStyleDefaults,
  TextStyleOverride,
} from '../../types';
import { TEXT_MAX_LENGTH } from '../../types/text';
import type { LipColorConfig } from '../../types/featureColors';
import { DEFAULT_BIN_PARAMS } from '../../constants';
import { isErr } from '@/core/result';
import {
  isRectangularSelection,
  normalizeIdsWithRemap,
  remapCompartmentTexts,
  remapDividerOverrides,
} from '../../utils/compartments';
import { validateCompartmentSizes } from '../../utils/validation';
import { defaultsForNewDesign, paramsNeedHalfGridMode, pushHistoryEntry } from '../helpers';
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
          newCompartments.thickness,
          params.gridUnitMm
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
        const gridUnitMm = partial.gridUnitMm ?? params.gridUnitMm;
        const result = validateCompartmentSizes(
          width,
          depth,
          wallThickness,
          partial.compartments.cols,
          partial.compartments.rows,
          partial.compartments.thickness,
          gridUnitMm
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
        state.params = { ...defaultsForNewDesign() };
        // Keep UI toggles in sync with the resolved params: a custom default
        // may carry fractional dimensions (→ half-grid mode), and defaults
        // always strip `cellMask` (→ shape editor closed). Without this the
        // toggles would leak the previous design's state (issue #1752).
        state.ui.halfGridMode = paramsNeedHalfGridMode(state.params);
        state.ui.shapeEditorOpen = false;
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

    updateOverhang: (partial: Partial<OverhangConfig>) => {
      set((state) => {
        pushHistoryEntry(state);
        // Overhang is outward-only; clamp each side to >= 0 so the store never
        // holds an inverting value (the generator clamps too, defensively).
        const current = state.params.overhang ?? {
          left: 0,
          right: 0,
          front: 0,
          back: 0,
          feet: false,
        };
        const next = { ...current, ...partial };
        state.params.overhang = {
          left: Math.max(0, next.left),
          right: Math.max(0, next.right),
          front: Math.max(0, next.front),
          back: Math.max(0, next.back),
          feet: next.feet ?? false,
          ...(next.enabled !== undefined ? { enabled: next.enabled } : {}),
        };
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
      enabled?: boolean;
      body?: string;
      lip?: Partial<LipColorConfig>;
      labelTab?: string;
      base?: string;
      scoop?: string;
      dividers?: string;
      text?: string;
      lid?: string;
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
        // Multi-color toggle drives the color-tool overlay's visibility; if the
        // user disables multi-color while a tool is active, the overlay unmounts
        // but `ui.colorTool` would otherwise stay set, leaving the canvas in
        // crosshair mode and the eyedropper banner ready to flash back on next
        // enable. Clear all tool state in lockstep.
        if (patch.enabled === false) {
          state.ui.colorTool = null;
          state.ui.swapFirstZone = null;
          state.ui.hoveredColorZone = null;
          state.ui.pickerOverlay = null;
        }
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
        params.compartments.thickness,
        params.gridUnitMm
      );
      if (isErr(result)) return;

      set((state) => {
        pushHistoryEntry(state);
        const cells: number[] = [];
        for (let i = 0; i < rows * cols; i++) {
          cells.push(i);
        }
        // Old per-compartment text and divider overrides would attach to
        // unrelated cells once IDs regenerate — drop them.
        const {
          compartmentTexts: _dropTexts,
          dividerOverrides: _dropOverrides,
          ...keepCompartments
        } = state.params.compartments;
        state.params.compartments = {
          ...keepCompartments,
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
        const { cells: normalized, remap } = normalizeIdsWithRemap(newCells);
        const prevTexts = state.params.compartments.compartmentTexts;
        const prevOverrides = state.params.compartments.dividerOverrides;
        state.params.compartments = {
          ...state.params.compartments,
          cells: normalized,
          ...(prevTexts ? { compartmentTexts: remapCompartmentTexts(prevTexts, remap) } : {}),
          ...(prevOverrides
            ? { dividerOverrides: remapDividerOverrides(prevOverrides, remap) }
            : {}),
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
        params.compartments.thickness,
        params.gridUnitMm
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
        const { cells: normalized, remap } = normalizeIdsWithRemap(newCells);
        const prevTexts = state.params.compartments.compartmentTexts;
        const prevOverrides = state.params.compartments.dividerOverrides;
        state.params.compartments = {
          ...state.params.compartments,
          cells: normalized,
          ...(prevTexts ? { compartmentTexts: remapCompartmentTexts(prevTexts, remap) } : {}),
          ...(prevOverrides
            ? { dividerOverrides: remapDividerOverrides(prevOverrides, remap) }
            : {}),
        };
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
      // No-op guard: the UI calls this on every keystroke, so an unchanged
      // value must not push a history entry (would be one undo step per char).
      if ((prev[compartmentId] ?? '') === clamped) return;

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

    setTextDefaults: (partial: Partial<TextStyleDefaults>) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.textDefaults = { ...state.params.textDefaults, ...partial };
      });
    },

    setLabelTabTextStyle: (overrides: TextStyleOverride | null) => {
      set((state) => {
        pushHistoryEntry(state);
        if (overrides === null) {
          const { textStyle: _omit, ...rest } = state.params.label;
          state.params.label = rest;
        } else {
          state.params.label = { ...state.params.label, textStyle: overrides };
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
