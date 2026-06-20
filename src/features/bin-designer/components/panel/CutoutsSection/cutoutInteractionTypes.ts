/**
 * Type definitions and shared constants for the cutout interaction state machine.
 *
 * The `InteractionMode` discriminated union drives every pointer/keyboard
 * handler — a single `mode.type` switch produces the entire UX behavior.
 */

import type { Cutout, CutoutShape } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import type { MaskCellSize } from './maskFit';
import type { PathDrawingMode, VertexEditMode } from './handlers';
import type { StartRect } from './geometry';

/** Direction for resize handles */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Default sizes for click-to-place (mm) */
export const DEFAULT_RECT_SIZE = 20;
export const DEFAULT_CIRCLE_SIZE = 15;
/** Across-flats for a click-placed polygon (≈ a chunky 1/2" socket / large hex bit). */
export const DEFAULT_POLYGON_ACROSS_FLATS = 14;
/** Click-placed slot is an oblong capsule, not a square (which would render round). */
export const DEFAULT_SLOT_WIDTH = 30;
export const DEFAULT_SLOT_DEPTH = 12;

/** Paste offset in mm — each successive paste shifts by this amount */
export const PASTE_OFFSET = 2;

export type InteractionMode =
  | { readonly type: 'idle' }
  | { readonly type: 'placing'; readonly shape: CutoutShape }
  | {
      readonly type: 'pending-place';
      readonly shape: CutoutShape;
      readonly startMmX: number;
      readonly startMmY: number;
    }
  | {
      readonly type: 'drawing';
      readonly shape: CutoutShape;
      readonly startMmX: number;
      readonly startMmY: number;
    }
  | {
      readonly type: 'dragging';
      readonly startX: number;
      readonly startY: number;
      readonly offsets: ReadonlyMap<string, { readonly dx: number; readonly dy: number }>;
    }
  | {
      readonly type: 'dragging-label';
      readonly cutoutId: string;
      readonly startMmX: number;
      readonly startMmY: number;
      readonly startOffsetX: number;
      readonly startOffsetY: number;
    }
  | {
      readonly type: 'resizing';
      readonly cutoutId: string;
      readonly handle: ResizeHandle;
      readonly startRect: StartRect;
    }
  | {
      readonly type: 'rotating';
      readonly cutoutId: string;
      readonly startAngle: number;
      readonly initialRotation: number;
    }
  | {
      readonly type: 'group-rotating';
      readonly startAngle: number;
      readonly center: { readonly x: number; readonly y: number };
      readonly initialStates: ReadonlyMap<
        string,
        { readonly x: number; readonly y: number; readonly rotation: number }
      >;
    }
  | {
      readonly type: 'group-scaling';
      readonly startDist: number;
      readonly center: { readonly x: number; readonly y: number };
      readonly initialStates: ReadonlyMap<
        string,
        {
          readonly x: number;
          readonly y: number;
          readonly width: number;
          readonly depth: number;
        }
      >;
    }
  | { readonly type: 'marquee'; readonly startX: number; readonly startY: number }
  | PathDrawingMode
  | VertexEditMode
  | { readonly type: 'ruler-ready' }
  | {
      readonly type: 'measuring';
      readonly startX: number;
      readonly startY: number;
      /** When true, return to ruler-ready on pointer up; otherwise return to idle (Shift+drag) */
      readonly sticky: boolean;
    };

/** Preview overrides applied during drag/resize for visual feedback */
export type PreviewMap = ReadonlyMap<string, Partial<Cutout>>;

export interface UseCutoutInteractionOptions {
  readonly cutouts: readonly Cutout[];
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onRemove: (id: string) => void;
  readonly onAdd: (cutout: Cutout) => void;
  readonly onGroup?: (cutoutIds: readonly string[]) => void;
  readonly onUngroup?: (cutoutIds: readonly string[]) => void;
  readonly onUpdateBatch?: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  readonly onRemoveBatch?: (ids: readonly string[]) => void;
  readonly onUndo?: () => void;
  readonly onRedo?: () => void;
  readonly canUndo?: boolean;
  readonly canRedo?: boolean;
  readonly onLock?: (ids: readonly string[]) => void;
  readonly onUnlock?: (ids: readonly string[]) => void;
  readonly startTransaction?: () => void;
  readonly commitTransaction?: () => void;
  readonly binWidth: number;
  readonly binDepth: number;
  readonly gridSize?: number;
  /** Non-rectangular footprint mask — when present, rejects placements outside the polygon. */
  readonly cellMask?: CellMask;
  /** Mm per mask cell. Required alongside cellMask; X/Y differ on non-square bins. */
  readonly maskCellSize?: MaskCellSize;
}
