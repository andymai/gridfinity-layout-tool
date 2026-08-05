import {
  LID_MAGNET_DEPTH_DEFAULT_MM,
  LID_MAGNET_DIAMETER_DEFAULT_MM,
  LID_MAGNET_EDGE_COUNT_DEFAULT,
} from './lid';
import type { LidAttachment, LidClickRails, LidMagnetConfig } from './lid';

/** Base attachment style for bin-to-baseplate connection */
export type BaseStyle =
  'standard' | 'magnet' | 'screw' | 'magnet_and_screw' | 'weighted' | 'flat' | 'lid';

/** True when `style` includes magnet pockets — single source of truth so
 *  callers don't drift if a new magnet-inclusive style is added. */
export function isMagnetStyle(style: BaseStyle): boolean {
  return style === 'magnet' || style === 'magnet_and_screw';
}

/** True when `style` includes screw mounts — paired with `isMagnetStyle`. */
export function isScrewStyle(style: BaseStyle): boolean {
  return style === 'screw' || style === 'magnet_and_screw';
}

/**
 * True when the base has no Gridfinity socket under it — a flat base or a tray
 * bottom. The distinction matters wherever code asks "is there a socket to
 * shell, drill, halve, or stand this bin on".
 */
export function isSocketlessBase(style: BaseStyle): boolean {
  return style === 'flat' || style === 'lid';
}

/**
 * Mating geometry for a {@link BaseStyle} of `'lid'` (#3036): a fully editable
 * bin whose underside is a lid instead of a Gridfinity base, so it caps the bin
 * below it.
 *
 * A narrow subset of `LidConfig`, with matching field names and units. The
 * omitted fields all describe a lid's TOP (`topThicknessMm`, `stackableTop`,
 * `separateStackPlate`, `tray`); a tray bin's top is its own compartment
 * interior, so carrying them here would leave inert knobs for the UI and
 * validation to drift apart over.
 */
export interface TrayBottomConfig {
  readonly attachment: LidAttachment;
  /** Extra skirt depth (mm) to clear contents protruding from the bin below. */
  readonly extraHeightMm: number;
  readonly clickRails: LidClickRails;
  readonly clickRailCoverage: number;
  /** Only meaningful when {@link attachment} is `'magnetic'`. */
  readonly retentionMagnet: LidMagnetConfig;
}

/**
 * Mirrors `DEFAULT_LID_CONFIG` field for field, so a tray bottom and a lid of
 * the same attachment print the same joint.
 */
export const DEFAULT_TRAY_BOTTOM: TrayBottomConfig = {
  attachment: 'clickRails',
  extraHeightMm: 0,
  clickRails: { front: true, back: true, left: true, right: true },
  clickRailCoverage: 50,
  retentionMagnet: {
    diameter: LID_MAGNET_DIAMETER_DEFAULT_MM,
    depth: LID_MAGNET_DEPTH_DEFAULT_MM,
    edgeMagnets: LID_MAGNET_EDGE_COUNT_DEFAULT,
  },
} as const;

/** Bin wall/style variants — single source of truth for the `BinStyle` union. */
export const BIN_STYLES = ['standard', 'slotted', 'solid'] as const;

/** Bin wall/style variant */
export type BinStyle = (typeof BIN_STYLES)[number];

/** Base configuration for bin attachment */
export interface BaseConfig {
  readonly style: BaseStyle;
  readonly magnetDiameter: number;
  readonly magnetDepth: number;
  readonly screwDiameter: number;
  readonly stackingLip: boolean;
  /** When true, the bin body is a solid block (no cavity). Used by cutouts feature. */
  readonly solid: boolean;
  /** When true, subdivides each cell into 0.5×0.5 half sockets instead of full 1×1 sockets. */
  readonly halfSockets: boolean;
  /**
   * When true, the base is shelled to a uniform `wallThickness` instead of a
   * solid floor + feet: the cavity floor follows the inside of the socket
   * taper, exposing the grid shape on the interior and saving filament
   * ("Gridfinity Lite"). Magnet/screw pads are retained as solid islands.
   */
  readonly lightweight: boolean;
  /**
   * Spacer / riser mode (#2869): a floorless frame that lifts a bin so bins of
   * different heights line up flush. Feet and stacking lip are unchanged, so its
   * height counts in the stack exactly like a bin of the same height — a 2u
   * spacer under a 2u bin reaches the top of a 4u one.
   *
   * The floor is punched through every cell, leaving the shelled feet plus the
   * webbing between them as the structure. Interior features (compartments,
   * scoops, labels, inserts, cutouts, floor patterns) have no floor to sit on and
   * are ruled out by the constraint engine; wall features still apply.
   */
  readonly spacer: boolean;
  /**
   * Underside mating geometry, read only when {@link style} is `'lid'`.
   * Optional because it must stay out of an ordinary bin's params hash (see
   * `DEFAULT_BIN_PARAMS`); `migrateParams` backfills it for a lid base.
   */
  readonly trayBottom?: TrayBottomConfig;
}
