/**
 * Shared types for cutout interaction handlers.
 *
 * Each pointer-move handler receives a focused context containing only
 * the state and callbacks it needs, keeping handlers decoupled from the
 * full hook state.
 */

import type { Cutout, CutoutShape } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import type { AlignmentGuide } from '../geometry';
import type { MaskCellSize } from '../maskFit';
import type { InteractionMode } from '../useCutoutInteraction';

// ── Pointer event context shared by all move handlers ────────────────────────

/** Current cursor position and modifier keys, passed to every move handler. */
export interface PointerMoveEvent {
  readonly mmX: number;
  readonly mmY: number;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
}

// ── Bin dimensions & snapping ────────────────────────────────────────────────

/** Bin boundary dimensions needed for clamping and constraint. */
export interface BinBounds {
  readonly binWidth: number;
  readonly binDepth: number;
  /** Present only when the bin has a non-rectangular (custom) footprint. */
  readonly cellMask?: CellMask;
  /** Mm per mask cell. Required alongside cellMask; separate X/Y for non-square bins. */
  readonly maskCellSize?: MaskCellSize;
}

/** Snap function that respects the current snap-enabled state. */
export type SnapFn = (v: number) => number;

// ── Preview / guide setters ──────────────────────────────────────────────────

/** Map of cutout ID to partial updates shown during interaction. */
export type PreviewMap = ReadonlyMap<string, Partial<Cutout>>;

/** Callbacks the handlers use to push visual feedback into React state. */
export interface PreviewSetters {
  readonly setPreview: (preview: PreviewMap) => void;
  readonly setActiveGuides: (guides: AlignmentGuide[]) => void;
  readonly setDrawingPreview: (
    preview: {
      x: number;
      y: number;
      width: number;
      depth: number;
      shape: CutoutShape;
    } | null
  ) => void;
}

// ── Dead-zone ref ────────────────────────────────────────────────────────────

/** Mutable ref tracking whether the dead zone has been exceeded. */
export interface DeadZoneRef {
  current: boolean;
}

// ── Mode transition ──────────────────────────────────────────────────────────

export type { InteractionMode } from '../useCutoutInteraction';

/** Callback to transition the interaction state machine. */
export type SetModeFn = (mode: InteractionMode) => void;
