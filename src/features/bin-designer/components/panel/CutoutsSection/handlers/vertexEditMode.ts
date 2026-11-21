/**
 * The state of vertex editing: what is selected, what is being dragged, and
 * the helpers every vertex handler reads the selection through.
 */

import type { Cutout } from '@/features/bin-designer/types';
import type { DragSource } from './pathRings';
import type { Rect } from './pointEdits';
import type { TransformHandle } from './pointTransform';
import type { FalloffGrab } from './falloffDrag';
import type { PreviewSetters, SetModeFn } from './types';

/**
 * Target being dragged during vertex editing. `ring` 0 is the outline and
 * ring k the cutout's island k - 1.
 *
 * A press on an edge is a `segment` until the pointer moves: let go there and
 * it adds a point, drag and it becomes a `falloff` pull. Canvas positions
 * (`startX`, `x`) are as drawn; everything else is in the path's own frame.
 */
export type VertexDragTarget =
  | { readonly type: 'vertex'; readonly ring: number; readonly index: number }
  | {
      readonly type: 'handle';
      readonly ring: number;
      readonly index: number;
      readonly handleType: 'in' | 'out';
    }
  | {
      readonly type: 'points';
      readonly ring: number;
      /** The point under the pointer, which snaps; the rest move by as much. */
      readonly index: number;
      readonly indices: readonly number[];
    }
  | {
      readonly type: 'segment';
      readonly ring: number;
      readonly segmentIndex: number;
      readonly t: number;
      readonly startX: number;
      readonly startY: number;
    }
  | {
      readonly type: 'falloff';
      readonly ring: number;
      readonly grab: FalloffGrab;
      readonly startX: number;
      readonly startY: number;
      /** The pull so far, in the path's frame: pointer-up has no position to read. */
      readonly dx: number;
      readonly dy: number;
    }
  | {
      readonly type: 'marquee';
      readonly ring: number;
      readonly startX: number;
      readonly startY: number;
      readonly x: number;
      readonly y: number;
      readonly additive: boolean;
    }
  | {
      readonly type: 'transform';
      readonly ring: number;
      readonly indices: readonly number[];
      readonly handle: TransformHandle;
      readonly box: Rect;
      readonly startX: number;
      readonly startY: number;
    };

/** Mode state for vertex editing, entered by double-clicking a path cutout. */
export interface VertexEditMode {
  readonly type: 'vertex-editing';
  readonly cutoutId: string;
  /** The ring the selected point is on, as in `VertexDragTarget`. */
  readonly ring: number;
  /** The point whose handles show, the last one picked. */
  readonly selectedPointIndex: number | null;
  /** Every selected point on `ring`, when more than one is. */
  readonly selectedPoints?: readonly number[];
  /** How far a grabbed edge pulls the outline with it, in mm. */
  readonly falloffMm?: number;
  readonly dragTarget: VertexDragTarget | null;
  /** The rings and turn the drag began from, to tell when they change under it. */
  readonly dragFrom?: DragSource | null;
}

/** Info about the segment the cursor is hovering near (for add-point preview). */
export interface SegmentHoverInfo {
  readonly ring: number;
  readonly segmentIndex: number;
  readonly t: number;
  readonly x: number;
  readonly y: number;
}

/** Callbacks the vertex edit handlers use to update state. */
export interface VertexEditSetters {
  readonly setMode: SetModeFn;
  readonly setPreview: PreviewSetters['setPreview'];
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly setSegmentHover: (hover: SegmentHoverInfo | null) => void;
}

/** The mode a path's point editing opens in. */
export function vertexEditingMode(cutoutId: string, falloffMm?: number): VertexEditMode {
  return {
    type: 'vertex-editing',
    cutoutId,
    ring: 0,
    selectedPointIndex: null,
    dragTarget: null,
    ...(falloffMm === undefined ? {} : { falloffMm }),
  };
}

/** The selected points, as indices on `mode.ring`. */
export function selectedIndices(mode: VertexEditMode): number[] {
  if (mode.selectedPoints && mode.selectedPoints.length > 0) return [...mode.selectedPoints];
  return mode.selectedPointIndex === null ? [] : [mode.selectedPointIndex];
}

/** `mode` with `indices` on `ring` selected, `primary` (or the last) showing its handles. */
export function withSelection(
  mode: VertexEditMode,
  ring: number,
  indices: readonly number[],
  primary?: number
): VertexEditMode {
  const shown = primary !== undefined && indices.includes(primary) ? primary : indices.at(-1);
  return {
    ...mode,
    ring,
    selectedPointIndex: shown ?? null,
    selectedPoints: indices.length > 1 ? [...indices] : undefined,
  };
}
