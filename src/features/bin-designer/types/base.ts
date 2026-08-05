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
 * True when the underside is lid mating geometry rather than a Gridfinity
 * socket. Grouped with the two predicates above so callers branch on intent
 * instead of on a string, and a later mating style joins in one place.
 */
export function isLidBase(style: BaseStyle): boolean {
  return style === 'lid';
}

/**
 * Mating geometry for a {@link BaseStyle} of `'lid'` (issue #3036): a normal,
 * fully editable bin whose underside is a lid instead of a Gridfinity base, so
 * a shallow organiser can cap the bin below it.
 *
 * Deliberately a narrow subset of {@link LidConfig} rather than the whole
 * thing. Field names and units match it exactly — notably `extraHeightMm`,
 * which means the same "lengthen the skirt to clear contents that stick up"
 * it means on a lid (issue #2482), and is the reason this feature works for
 * the reporter's protruding contents. The omitted fields describe a lid's TOP
 * (`topThicknessMm`, `stackableTop`, `separateStackPlate`, `tray`); a tray
 * bin's top is its own compartment interior, so carrying them here would
 * leave inert knobs for the UI and validation to drift apart over.
 */
export interface TrayBottomConfig {
  readonly attachment: LidAttachment;
  /**
   * Extra skirt depth (mm) below the tray floor, so contents protruding from
   * the bin underneath are cleared. `0` mates flush like a plain lid.
   */
  readonly extraHeightMm: number;
  readonly clickRails: LidClickRails;
  readonly clickRailCoverage: number;
  /** Only meaningful when {@link attachment} is `'magnetic'`. */
  readonly retentionMagnet: LidMagnetConfig;
}

/**
 * Default mating geometry for a tray bin. Mirrors `DEFAULT_LID_CONFIG` field
 * for field so a tray bottom and a lid of the same attachment print the same
 * joint; only the lid's top-surface fields are absent.
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
   * Optional so every existing design deserialises unchanged; `migrateParams`
   * backfills the default.
   */
  readonly trayBottom?: TrayBottomConfig;
}
