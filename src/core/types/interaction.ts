import type { BinId } from '@gridfinity/branded-types';
import type { Coord, Rect } from './layout';
import type { ValidationReason, BlockingInfo } from './validation';
export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Handle placement mode for resize handles */
export type HandlePlacement = 'internal' | 'external';

/** Handle variant for styling (primary vs ghost) */
export type HandleVariant = 'primary' | 'ghost';

/** Position configuration for a single handle */
export interface HandlePositionConfig {
  left?: number | string;
  right?: number | string;
  top?: number | string;
  bottom?: number | string;
  width: number | string;
  height: number | string;
  minWidth?: number;
  minHeight?: number;
  cursor: string;
  transform?: string;
}

/** Visual indicator configuration */
export interface HandleVisualConfig {
  width: number | string;
  height: number | string;
  minWidth?: number;
  minHeight?: number;
}

/**
 * Information about a potential swap target during drag.
 * Set when dragging a bin over another bin with compatible size.
 */
export interface SwapTarget {
  /** ID of the target bin that would be swapped */
  binId: BinId;
  /** True if swap requires rotating the dragged bin (e.g., 2×3 onto 3×2) */
  requiresRotation: boolean;
  /** Mobile countdown state (only set on touch devices during long-press) */
  countdown?: {
    /** When countdown started (Date.now()) */
    startTime: number;
    /** Total countdown duration in ms (1000) */
    duration: number;
  };
}

/**
 * How a fits-gap selection was initiated. 'right-drag' (the power-user
 * shortcut) only commits after real drag movement, though any right press on
 * empty canvas suppresses the browser context menu while the flag is on
 * (contextmenu timing is platform-split, so movement cannot gate it);
 * 'armed' (the toolbar's find-bins mode, the touch-reachable path) lets a
 * single tap select a minimum-size gap.
 */
export type FitsGapSource = 'right-drag' | 'armed';

export type Interaction =
  | {
      type: 'draw';
      start: Coord;
      current: Coord;
      /** Gap selection for the community "find bins that fit" flow: release hands off a constraint instead of creating a bin. */
      fitsGap?: FitsGapSource;
    }
  | {
      type: 'drag';
      binIds: BinId[];
      startCoord: Coord;
      currentCoord: Coord;
      valid: boolean;
      isOverGrid: boolean;
      clickOffset?: { x: number; y: number };
      duplicate?: boolean;
      /** True when user is holding Shift (desktop) or long-pressing (mobile) for swap mode */
      swapMode?: boolean;
      /** Target bin for swap if hovering over a compatible bin */
      swapTarget?: SwapTarget;
      /** True when position was auto-adjusted to nearest valid spot (shows amber tint) */
      isSnapped?: boolean;
      /** Why placement is invalid (for user feedback) */
      invalidReason?: ValidationReason;
      /** Details about what's blocking placement */
      blockingInfo?: BlockingInfo;
    }
  | {
      type: 'resize';
      binIds: BinId[];
      handle: ResizeHandle;
      startRects: Map<BinId, Rect>;
      currentRects: Map<BinId, Rect>;
      valid: boolean;
      /** True when size was auto-constrained to collision boundary (shows amber tint) */
      isSnapped?: boolean;
      /** Why resize is invalid (for user feedback) */
      invalidReason?: ValidationReason;
      /** Details about what's blocking the resize */
      blockingInfo?: BlockingInfo;
    }
  | {
      type: 'stagingDrag';
      binId: BinId;
      currentCoord: Coord | null;
      valid: boolean;
      /** True when position was auto-adjusted to nearest valid spot (shows amber tint) */
      isSnapped?: boolean;
      /** Why placement is invalid (for user feedback) */
      invalidReason?: ValidationReason;
      /** Details about what's blocking placement */
      blockingInfo?: BlockingInfo;
    }
  | { type: 'paint'; paintSize: { width: number; depth: number }; start: Coord; current: Coord };
