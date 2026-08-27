/**
 * Knife-block math and config shared by the editor, the preview, and the
 * generation worker (via the `@/shared/types/bin` re-export): slot sizing from
 * a knife's measurements, and the handle-rest companion derivation.
 *
 * The physical model: the knife lies horizontally. Its blade hangs in a
 * `knifeSlot` cutout with the spine flush with the block top, so the edge
 * floats {@link KNIFE_SLOT_EDGE_FLOAT} above the slot floor and never touches
 * material. The handle extends past the block's open end and lies in a saddle
 * groove on the rest, whose height is derived from the handle diameter — the
 * rest carries the knife, not the edge.
 */

import type { KnifeSpec } from './cutout';

/** Extra slot length past the blade so the tip never bottoms against the closed end (mm). */
export const KNIFE_SLOT_LENGTH_MARGIN = 10;
/** Width added to the spine thickness so the blade drops in without binding (mm). */
export const KNIFE_SLOT_WIDTH_CLEARANCE = 1.5;
/** Narrowest slot the editor will derive — thinner prints as a fused seam (mm). */
export const KNIFE_SLOT_MIN_WIDTH = 2.8;
/**
 * Slot depth past the heel height. With the spine flush at the block top this
 * is exactly how far the edge floats above the slot floor (mm).
 */
export const KNIFE_SLOT_EDGE_FLOAT = 4;

/**
 * Lead-in chamfer a new knife slot gets (mm). Wider than the generic insert
 * default (0.4-0.8): the flare is what lets a blade drop in without scraping
 * the mouth, and a 3.8mm slot with a 1.2mm bevel opens to ~6.2mm at the rim.
 */
export const KNIFE_SLOT_DEFAULT_CHAMFER = 1.2;

/** Slot cut dimensions derived from a knife's nominal measurements. */
export interface KnifeSlotDimensions {
  /** Slot length along its long (local X) axis (mm). */
  readonly widthMm: number;
  /** Slot thickness (mm). */
  readonly depthMm: number;
  /** Cut depth from the solid top (mm). */
  readonly cutDepthMm: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function knifeSlotDimensions(knife: KnifeSpec): KnifeSlotDimensions {
  return {
    widthMm: round1(knife.bladeLengthMm + KNIFE_SLOT_LENGTH_MARGIN),
    depthMm: round1(
      Math.max(KNIFE_SLOT_MIN_WIDTH, knife.spineThicknessMm + KNIFE_SLOT_WIDTH_CLEARANCE)
    ),
    cutDepthMm: round1(knife.heelHeightMm + KNIFE_SLOT_EDGE_FLOAT),
  };
}

// ── Handle rest ──────────────────────────────────────────────────────────────

/**
 * Where the handle rest lives:
 *  - `companion` — a separate small solid beside the block (its own Gridfinity
 *    foot), generated with the design like the lid and placed past the slots'
 *    open end.
 *  - `integrated` — the rear section of the block itself drops to rest height
 *    with the saddle carved into it.
 */
export type KnifeRestStyle = 'companion' | 'integrated';

/**
 * Handle-rest configuration. Absent on {@link import('./binParams').BinParams}
 * = no rest (pre-feature designs serialize byte-identically).
 */
export interface KnifeRestConfig {
  readonly enabled: boolean;
  /** Absent = `'companion'`. */
  readonly style?: KnifeRestStyle;
  /**
   * Free drawer space between the block's open end and the rest (mm).
   * Absent = {@link KNIFE_REST_DEFAULT_GAP_MM}. Companion style only.
   */
  readonly gapMm?: number;
  /**
   * Companion footprint along the knife axis, in grid units (0.5 steps).
   * Absent = 1. The cross-axis footprint always matches the block's, so every
   * slot's groove lands on the rest.
   */
  readonly depthU?: number;
  /** Saddle groove depth into the rest top (mm). Absent = {@link KNIFE_REST_GROOVE_DEPTH_MM}. */
  readonly grooveDepthMm?: number;
  /** Hex filament color for the rest solid. Absent = body color. */
  readonly color?: string;
}

/** Default free space between block and companion rest: half a grid cell (mm). */
export const KNIFE_REST_DEFAULT_GAP_MM = 21;
/** Default saddle groove depth (mm). */
export const KNIFE_REST_GROOVE_DEPTH_MM = 6;
/** Groove width beyond the handle diameter so any handle section settles in (mm). */
export const KNIFE_REST_GROOVE_EXTRA_WIDTH_MM = 6;
/**
 * The saddle sits this far below the exact level-lie height, tilting the knife
 * a hair handle-down so the handle always carries and the edge always floats (mm).
 */
export const KNIFE_REST_HANDLE_DROP_MM = 1;
/** Companion rest bounds (mm / grid units) shared by editor and validation. */
export const KNIFE_REST_MAX_GAP_MM = 200;
export const KNIFE_REST_MIN_DEPTH_U = 0.5;
export const KNIFE_REST_MAX_DEPTH_U = 4;
export const KNIFE_REST_MIN_GROOVE_DEPTH_MM = 0;
export const KNIFE_REST_MAX_GROOVE_DEPTH_MM = 15;

export function knifeRestStyle(rest: KnifeRestConfig): KnifeRestStyle {
  return rest.style ?? 'companion';
}

// ── Orientation ──────────────────────────────────────────────────────────────

/**
 * A knife slot only opens a wall, seats a rest, and shows its ghost when it is
 * aligned to one of the four walls (`rotation % 90 === 0`); the breach, lip-gap
 * and rest math are all axis-aligned by construction. Off-axis the slot silently
 * loses all three, so the editor snaps a knife slot's angle to a quarter turn
 * rather than letting it drift there. A free-angle rounded pocket is what the
 * plain `slot` shape is for.
 */
export type KnifeSlotAxis = 'horizontal' | 'vertical';

/** Whether a wall-aligned knife slot lies along the bin's width or its depth. */
export function knifeSlotAxis(rotation: number): KnifeSlotAxis {
  const steps = ((Math.round(rotation / 90) % 4) + 4) % 4;
  return steps % 2 === 0 ? 'horizontal' : 'vertical';
}

/** Snap any angle to the nearest wall-aligned quarter turn, in [0, 360). */
export function snapKnifeRotation(rotation: number): number {
  return (((Math.round(rotation / 90) * 90) % 360) + 360) % 360;
}

/**
 * The solid fill surface's height above the print bottom (= the baseplate
 * seat both the block and its rest stand on). `height × heightUnitMm` already
 * spans the base socket (gotcha #14), so the fill top is simply that total
 * minus the global top offset.
 */
export function knifeBlockTopZMm(params: {
  readonly height: number;
  readonly heightUnitMm: number;
  readonly cutoutConfig: { readonly topOffset: number };
}): number {
  return params.height * params.heightUnitMm - params.cutoutConfig.topOffset;
}

/** Saddle groove width for a knife's handle (mm). */
export function knifeRestGrooveWidthMm(knife: KnifeSpec): number {
  return knife.handleWidthMm + KNIFE_REST_GROOVE_EXTRA_WIDTH_MM;
}

/**
 * Height of a knife's saddle contact line (groove bottom) above the plane the
 * BLOCK TOP is measured from. With the spine flush at the block top, the
 * handle underside lies one handle-height below it; the drop keeps the handle
 * carrying the weight.
 */
export function knifeRestSaddleZMm(blockTopZMm: number, knife: KnifeSpec): number {
  return blockTopZMm - knife.handleHeightMm - KNIFE_REST_HANDLE_DROP_MM;
}

/**
 * Rest body top for a set of knives sharing one rest: tall enough that every
 * knife's groove reaches its own saddle depth. Grooves for smaller handles cut
 * deeper than `grooveDepthMm`; the widest-handled knife's groove defines the top.
 */
export function knifeRestBodyTopZMm(
  blockTopZMm: number,
  knives: readonly KnifeSpec[],
  grooveDepthMm: number
): number {
  const highest = Math.max(...knives.map((k) => knifeRestSaddleZMm(blockTopZMm, k)));
  return highest + grooveDepthMm;
}
