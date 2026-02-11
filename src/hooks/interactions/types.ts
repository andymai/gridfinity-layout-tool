import type { RefObject } from 'react';
import type {
  Bin,
  BinId,
  LayerId,
  CategoryId,
  Coord,
  Layout,
  Rect,
  ResizeHandle,
  Interaction,
} from '@/core/types';
import type { Result } from '@/core/result';
import type { ValidationError, LayoutError } from '@/core/result';

/**
 * Paint size configuration for paint mode interactions.
 */
export interface PaintSize {
  width: number;
  depth: number;
}

/**
 * Shared context passed to all mode-specific interaction hooks.
 * Contains all dependencies needed for interaction processing.
 *
 * This approach uses a stable object (via useMemo) rather than React Context
 * to minimize indirection and keep the implementation simple.
 */
export interface InteractionContext {
  // Grid utilities from useGridCoords
  getGridCoords: (clientX: number, clientY: number) => Coord | null;
  clampCoords: (coord: Coord) => Coord;
  isInBounds: (coord: Coord) => boolean;
  gridRef: RefObject<HTMLDivElement | null>;

  // Store state (stable references)
  layout: Layout;
  activeLayerId: LayerId;
  activeCategoryId: CategoryId;
  paintSize: PaintSize | null;
  selectedBinIds: BinId[];

  // Store actions (from useInteractionStore and useSelectionStore)
  setInteraction: (interaction: Interaction | null) => void;
  setDropTarget: (target: 'trash' | 'staging' | null) => void;
  setSelectedBin: (id: BinId | null) => void;
  setSelectedBins: (ids: BinId[]) => void;

  // Mutations (from MutationsContext, wrapped for collaborative mode)
  addBin: (params: AddBinParams) => Result<BinId, ValidationError | LayoutError>;
  updateBin: (id: BinId, updates: Partial<Bin>) => void;
  deleteBin: (id: BinId) => void;

  // Undo/redo wrapper
  execute: (fn: () => void) => void;

  // Shared refs for pointer tracking (managed by parent)
  activePointerIdRef: RefObject<number | null>;
  capturedPointerRef: RefObject<PointerCaptureHandle | null>;
}

/**
 * Parameters for adding a new bin.
 */
export interface AddBinParams {
  layerId: LayerId;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  category: CategoryId;
  label: string;
  notes: string;
  clearanceHeight?: number;
  customProperties?: Record<string, string>;
}

/**
 * Pointer capture handle for cleanup.
 */
export interface PointerCaptureHandle {
  element: HTMLElement;
  pointerId: number;
}

/**
 * Return type for mode-specific interaction hooks.
 * Each mode hook returns handlers that the parent hook dispatches to.
 */
export interface ModeHandlers<TStart extends unknown[] = []> {
  /** Initialize the interaction */
  start: (...args: TStart) => void;
  /** Process pointer movement during interaction */
  handleMove: (coords: Coord, clamped: Coord) => void;
  /** Complete the interaction on pointer up */
  handleUp: () => void;
}

/**
 * Draw mode start parameters.
 */
export type DrawStartArgs = [coord: Coord, pointerId?: number];

/**
 * Drag mode start parameters.
 */
export type DragStartArgs = [
  binId: BinId,
  clientX: number,
  clientY: number,
  pointerId?: number,
  duplicate?: boolean,
  swapMode?: boolean,
];

/**
 * Resize mode start parameters.
 */
export type ResizeStartArgs = [binId: BinId, handle: ResizeHandle, pointerId?: number];

/**
 * Staging drag mode start parameters.
 */
export type StagingDragStartArgs = [binId: BinId, pointerId?: number];

// Re-export types that mode hooks need
export type { Bin, Coord, Layout, Rect, ResizeHandle, Interaction };
