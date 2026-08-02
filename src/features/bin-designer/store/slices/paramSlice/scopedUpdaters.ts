/**
 * Scoped updaters: merge a partial into one nested config (base, label, walls,
 * handles, patterns, colors, lid, cutout config, text defaults). Also the
 * non-bin item structure/envelope updaters, which bump the generation epoch
 * directly instead of pushing history.
 */

import type {
  BaseConfig,
  LabelTabConfig,
  ScoopConfig,
  WallConfig,
  OverhangConfig,
  WallCutout,
  WallSide,
  WallPatternConfig,
  FloorPatternConfig,
  CutoutConfig,
  HandleConfig,
  HandleSide,
  HandleWallSide,
  LidConfig,
  TextStyleDefaults,
  TextStyleOverride,
} from '@/features/bin-designer/types';
import type { ItemEnvelope, ItemStructure } from '@/shared/types/item';
import {
  mergeLipConfig,
  type LipColorConfig,
  type TopAccentConfig,
} from '@/features/bin-designer/types/featureColors';
import { DEFAULT_FLOOR_PATTERN_CONFIG } from '@/features/bin-designer/constants';
import { pushHistoryEntry } from '@/features/bin-designer/store/helpers';
import type { Set } from './types';

export function createScopedUpdaters(set: Set) {
  return {
    // Scoped updaters -- merge partial into nested config
    updateBase: (partial: Partial<BaseConfig>) => {
      set((state) => {
        pushHistoryEntry(state);
        Object.assign(state.params.base, partial);
      });
    },

    // Non-bin item edits. History/undo is intentionally not wired for non-bin
    // kinds in this transitional phase — we bump the generation epoch directly
    // so the preview regenerates via the item path.
    updateStructure: (partial: Partial<ItemStructure>) => {
      set((state) => {
        if (state.itemKind === 'bin' || !state.structure) return;
        Object.assign(state.structure, partial);
        state.generation.epoch += 1;
      });
    },

    updateEnvelope: (partial: Partial<ItemEnvelope>) => {
      set((state) => {
        if (state.itemKind === 'bin' || !state.envelope) return;
        Object.assign(state.envelope, partial);
        state.generation.epoch += 1;
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
        // Carry the optional wall taper (#2933) through, clamped outward-only.
        // Per-side inset is clamped against overhang at generation time.
        const taper = next.taper
          ? {
              ...next.taper,
              bandHeight: Math.max(0, next.taper.bandHeight),
              left: Math.max(0, next.taper.left),
              right: Math.max(0, next.taper.right),
              front: Math.max(0, next.taper.front),
              back: Math.max(0, next.taper.back),
            }
          : undefined;
        state.params.overhang = {
          left: Math.max(0, next.left),
          right: Math.max(0, next.right),
          front: Math.max(0, next.front),
          back: Math.max(0, next.back),
          feet: next.feet ?? false,
          ...(next.enabled !== undefined ? { enabled: next.enabled } : {}),
          ...(taper ? { taper } : {}),
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

    updateFloorPattern: (partial: Partial<FloorPatternConfig>) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.floorPattern = {
          ...DEFAULT_FLOOR_PATTERN_CONFIG,
          ...state.params.floorPattern,
          ...partial,
        };
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
      topAccent?: Partial<TopAccentConfig>;
    }) => {
      set((state) => {
        pushHistoryEntry(state);
        const current = state.params.featureColors;
        const { lip: lipPatch, topAccent: topAccentPatch, ...rest } = patch;
        const nextLip: LipColorConfig = lipPatch
          ? mergeLipConfig(current.lip, lipPatch)
          : current.lip;
        const nextTopAccent: TopAccentConfig = topAccentPatch
          ? { ...current.topAccent, ...topAccentPatch }
          : current.topAccent;
        state.params.featureColors = {
          ...current,
          ...rest,
          lip: nextLip,
          topAccent: nextTopAccent,
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
  };
}
