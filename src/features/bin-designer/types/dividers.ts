import type { CompartmentGrid } from '@/shared/utils/compartmentGeometry';

/** Slot configuration for one axis */
export interface AxisSlotConfig {
  readonly enabled: boolean;
  /** Distance between slot centers in mm */
  readonly pitch: number;
}

export const CROSS_DIVIDER_STYLES = ['lap', 'insert'] as const;

/**
 * How cross dividers engage when both slot axes are enabled:
 * - 'lap': full-length dividers in both directions, interlocking via
 *   egg-crate cross-lap notches
 * - 'insert': full-length dividers along one axis (`longAxis`) carrying
 *   face receptacles; the other axis uses short per-compartment pieces
 */
export type CrossDividerStyle = (typeof CROSS_DIVIDER_STYLES)[number];

export const PARTIAL_DIVIDER_STYLES = ['full', 'snappable', 'lengthSet'] as const;

/**
 * How the interlocking (lap) cross dividers are offered when partial-length
 * pieces are wanted. Only meaningful when the effective cross mode is 'lap'
 * (both axes, egg-crate) — insert mode's continuous long dividers cannot be
 * crossed by a spanning piece, and single-axis pieces have no perpendicular
 * seat, so both force 'full'.
 * - 'full': one full wall-to-wall piece per axis (historical behavior)
 * - 'snappable': the full piece is scored just outboard of each crossing so
 *   it snaps to length while the wall-anchored remainder keeps a full notch
 * - 'lengthSet': a family of purpose-built pieces (wall-anchored and interior)
 *   spanning 1..N compartments, each with the correct cross-lap notches
 */
export type PartialDividerStyle = (typeof PARTIAL_DIVIDER_STYLES)[number];

export const SLOT_LAYOUTS = ['even', 'custom'] as const;

/**
 * How removable divider positions are decided:
 * - 'even': evenly spaced by pitch (the historical parametric behavior).
 * - 'custom': derived from an authored cols×rows grid (`SlotConfig.customGrid`),
 *   producing pieces that map 1:1 to a drawn layout.
 */
export type SlotLayout = (typeof SLOT_LAYOUTS)[number];

/** Slot configuration for removable divider walls */
export interface SlotConfig {
  /** Slots on left/right walls (for Y-axis dividers) */
  readonly x: AxisSlotConfig;
  /** Slots on front/back walls (for X-axis dividers) */
  readonly y: AxisSlotConfig;
  /** Slot opening width in mm */
  readonly width: number;
  /** Slot cut depth into wall in mm */
  readonly depth: number;
  /** Cross divider engagement when both axes are enabled. Optional for
   *  persisted configs predating the field; treated as 'lap'. */
  readonly crossStyle?: CrossDividerStyle;
  /** Axis that keeps full-length dividers in 'insert' mode. Optional;
   *  treated as 'y'. */
  readonly longAxis?: 'x' | 'y';
  /** Partial-length divider offering, honored only when the effective cross
   *  mode is 'lap'. Optional for persisted configs predating the field;
   *  treated as 'full'. */
  readonly partialStyle?: PartialDividerStyle;
  /** Layout strategy for the removable pieces. 'even' (default) spaces them by
   *  pitch; 'custom' derives them from an authored grid (`customGrid`). */
  readonly layout?: SlotLayout;
  /** Authored cols×rows grid backing 'custom' layout. Owned by slotConfig (not
   *  shared with the standard compartment grid) to keep the style→config
   *  invariant; intentionally omits angled-divider / label fields. */
  readonly customGrid?: CompartmentGrid;
}

/** Configuration for removable divider pieces */
export interface DividerPieceConfig {
  /** Height in mm, or 'auto' to match bin interior height */
  readonly height: number | 'auto';
  /** Divider wall thickness in mm */
  readonly thickness: number;
  /** Fit clearance in mm (subtracted from each side) */
  readonly clearance: number;
  /**
   * Cut a channel into the floor under each divider so its bottom edge is
   * seated. Off prints dividers for a bin made before the groove existed.
   */
  readonly floorGroove: boolean;
}
