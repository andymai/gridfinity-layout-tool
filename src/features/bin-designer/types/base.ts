/** Base attachment style for bin-to-baseplate connection */
export type BaseStyle = 'standard' | 'magnet' | 'screw' | 'magnet_and_screw' | 'weighted' | 'flat';

/** True when `style` includes magnet pockets — single source of truth so
 *  callers don't drift if a new magnet-inclusive style is added. */
export function isMagnetStyle(style: BaseStyle): boolean {
  return style === 'magnet' || style === 'magnet_and_screw';
}

/** True when `style` includes screw mounts — paired with `isMagnetStyle`. */
export function isScrewStyle(style: BaseStyle): boolean {
  return style === 'screw' || style === 'magnet_and_screw';
}

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
}
