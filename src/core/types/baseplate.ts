import type { Mm, GridUnits } from '@gridfinity/branded-types';
import type { FractionalEdge } from './drawerOutline';
/** Nine-point padding distribution anchor. First letter = vertical (t/m/b),
 * second = horizontal (l/c/r). 'custom' means user-edited per-side, no anchor. */
export type PaddingAnchor = 'tl' | 'tc' | 'tr' | 'ml' | 'c' | 'mr' | 'bl' | 'bc' | 'br' | 'custom';

/**
 * Vertical stack-print configuration (experimental). When enabled, each group
 * of identical baseplate pieces is duplicated along Z so a whole drawer's worth
 * of plates prints in one job. The bottom plate prints upright (bed adhesion,
 * no overhang); every plate above it is flipped upside down (community practice
 * that minimizes overhangs), separated by a thin air gap so the tower snaps
 * apart after printing. Each physical stack is capped at how many tiles fit the
 * printer's build height (`stackHeightCap`, from
 * `settings.printSettings.maxPrintHeightMm`), so an over-tall group splits into
 * several stacks.
 *
 * Connectors, magnet holes, and corner rounding are auto-disabled while enabled
 * (overhangs that can't print, and per-tile differences that would break the
 * uniform-tile assumption stacking relies on).
 */
export interface StackPrintParams {
  readonly enabled: boolean;
  /** Air gap between stacked copies (mm) — one print layer (~0.2mm) is typical. */
  readonly gapMm: Mm;
  /**
   * How many copies of the whole layout to print. Multiplies every unique
   * baseplate piece, so a single-plate layout stacks into a tower of N. Absent
   * ⇒ 1 (no duplication), preserving layouts saved before this field existed.
   */
  readonly copies?: number;
}

/** Default air gap between stacked copies — one 0.2mm layer. */
export const STACK_PRINT_DEFAULT_GAP_MM = 0.2;
/** Inclusive bounds + default for the whole-layout copy multiplier. */
export const STACK_PRINT_DEFAULT_COPIES = 1;
export const STACK_PRINT_MIN_COPIES = 1;
export const STACK_PRINT_MAX_COPIES = 20;
/**
 * Fallback cap on copies per physical stack, used only when no build-height
 * limit is supplied. The real per-stack cap is `stackHeightCap()`, derived from
 * the printer build height (`settings.printSettings.maxPrintHeightMm`), and can
 * exceed this on tall printers.
 */
export const STACK_PRINT_MAX_STACK_HEIGHT = 8;
/** Inclusive bounds on the separation gap (mm). */
export const STACK_PRINT_MIN_GAP_MM = 0.1;
export const STACK_PRINT_MAX_GAP_MM = 1.0;

/** Stored (persisted) baseplate config saved per-layout.
 * Padding is in mm; width/depth/gridUnitMm are NOT stored — they are derived from the
 * layout's drawer at generation time unless syncWithLayout is false, in which case
 * baseplateWidth/baseplateDepth override drawer dims. Bridged to the generation-time
 * {@link ResolvedBaseplateParams} via buildFullParams. */
export interface StoredBaseplateParams {
  readonly magnetHoles: boolean;
  readonly magnetDiameter: Mm;
  readonly magnetDepth: Mm;
  readonly paddingLeft: Mm;
  readonly paddingRight: Mm;
  readonly paddingFront: Mm;
  readonly paddingBack: Mm;
  readonly paddingAnchor?: PaddingAnchor;
  /**
   * Over-tile mode: fill the drawer-fit padding with functional Gridfinity grid
   * (a clipped tile per axis) instead of a solid plastic margin. A sub-threshold
   * sliver falls back to solid padding. Default false.
   */
  readonly overTile?: boolean;
  /**
   * Half-grid variant of over-tile: when over-tile is on, fill each margin with
   * true 21mm (0.5-unit) functional Gridfinity half-sockets first, then let the
   * sub-half-unit leftover fall back to the standard clipped tile. Only
   * meaningful when {@link overTile} is true. Default false (arbitrary clip).
   */
  readonly overTileHalfGrid?: boolean;
  /**
   * Half-grid leftover handling: when set, the sub-21mm remainder left after
   * packing 0.5-unit half-sockets stays solid plastic instead of becoming a
   * clipped grid pocket — so true half-grid cells read as distinct from the
   * unusable margin. Only meaningful when {@link overTileHalfGrid} is true.
   * Default false (leftover rendered as a clipped tile).
   */
  readonly overTileHalfGridSolidLeftover?: boolean;
  /** Enable registration nubs/holes on split piece join edges (default false). */
  readonly connectorNubs?: boolean;
  /** Remove center floor material, keeping only magnet pads (default true). */
  readonly lightweight?: boolean;
  /**
   * Leave a solid floor under every socket instead of cutting the pockets
   * through — a rigid/weighted plate (default false). The floor is added below
   * the 5mm socket, so the plate gets taller by {@link solidFloorThickness}; the
   * pocket depth (bin seating) is unchanged. With magnets it keeps the underside
   * continuous and the magnet holes are cut into it.
   */
  readonly solidFloor?: boolean;
  /**
   * Thickness (mm) of the {@link solidFloor}. Defaults to
   * `SOLID_FLOOR_DEFAULT_MM` (0.8mm) when omitted. Only meaningful when
   * `solidFloor` is true.
   */
  readonly solidFloorThickness?: Mm;
  /** When true (or undefined), grid dims are derived from the drawer. */
  readonly syncWithLayout?: boolean;
  /** Custom grid width in units, only used when syncWithLayout is false. */
  readonly baseplateWidth?: GridUnits;
  /** Custom grid depth in units, only used when syncWithLayout is false. */
  readonly baseplateDepth?: GridUnits;
  /** Swap tongue/groove convention on all join edges (default false). */
  readonly invertDovetails?: boolean;
  /**
   * When true, optimize for fewer unique part designs at the cost of more total
   * parts: split sizes are chosen to maximize same-size groups, dovetail
   * connectors become 180°-rotationally symmetric (M+F pair per cell boundary),
   * and pieces that are 180° rotations of each other share a fingerprint.
   *
   * Trade-off: produces 2× connector features per join boundary (denser BREP),
   * and may add 1–2 pieces compared to the piece-minimizing default.
   */
  readonly preferIdenticalPieces?: boolean;
  /**
   * Connector geometry on join edges when `connectorNubs` is enabled
   * (default 'dovetail'). 'puzzle' is a stronger integral connector — a jigsaw tab
   * (necked tongue/groove) that mechanically locks (the legacy 'dovetail' is a
   * near-flat slip fit; it's kept unchanged so plates already printed with it stay
   * reproducible). 'dovetailKey' cuts a female groove on both sides of each seam
   * and ships a separate, hammered-in dovetail key part instead of an integral
   * male tongue. 'snapClip' cuts a blind, ledged pocket on both sides of each seam
   * and ships a separate top-insert snap clip (a "staple") whose barbs catch the
   * pocket ledges. Only meaningful when `connectorNubs` is true.
   */
  readonly connectorStyle?: 'dovetail' | 'puzzle' | 'dovetailKey' | 'snapClip';
  /**
   * Cut the seam slot on the plate's exterior edges as well as on the join seams
   * between split pieces, so each piece is a standard 42mm-grid tile that can
   * key into any other plate printed later (issue #2866). Only meaningful for
   * the both-female styles (`dovetailKey`, `snapClip`) with `connectorNubs` on —
   * an integral tongue would protrude past the drawer-facing wall. Exterior
   * edges carrying drawer-fit padding are skipped (their wall is offset from the
   * grid, so a slot there would not line up). Default false.
   */
  readonly connectorSlotsAllEdges?: boolean;
  /**
   * User fit offset (mm) added to the per-side connector groove clearance to
   * compensate for printer/filament variation (issue #2024). Positive = looser,
   * negative = tighter; clamped so effective clearance never goes negative.
   * Default 0 / undefined leaves the nominal clearance unchanged. Only meaningful
   * when `connectorNubs` is true.
   */
  readonly connectorFitOffset?: number;
  /** Uniform outer corner radius in mm (default: Gridfinity spec 2.5mm). */
  readonly cornerRadius?: Mm;
  /** Per-corner radius overrides. When set, takes precedence over cornerRadius. */
  readonly cornerRadii?: {
    readonly tl: Mm;
    readonly tr: Mm;
    readonly bl: Mm;
    readonly br: Mm;
  };
  /** Which edge carries the half-unit column when baseplateWidth is fractional and syncWithLayout is false. Defaults to 'end' (right). */
  readonly fractionalEdgeX?: FractionalEdge;
  /** Which edge carries the half-unit row when baseplateDepth is fractional and syncWithLayout is false. Defaults to 'end' (top). */
  readonly fractionalEdgeY?: FractionalEdge;
  /**
   * Detach the drawer-fit padding into separate printable rail pieces so a bad
   * margin doesn't scrap the whole plate (issue #2392). Each side with padding ≥
   * {@link MARGIN_MIN_DETACH_MM} becomes its own rail; the body prints
   * padding-free on detached sides. Composes with {@link stackPrint} (#2641):
   * rails export as flat pieces alongside the stacked towers. Default false.
   */
  readonly detachMargins?: boolean;
  /**
   * Opt-in connector between the body and each detached long-rail margin
   * (issue #2414). Adds a tongue/groove at the body↔long-rail seam using the
   * body's {@link connectorStyle} so the rail attaches securely instead of
   * relying on friction. Short rails and corners stay friction-fit. Only
   * meaningful when {@link detachMargins} is true. Default false.
   */
  readonly detachMarginConnector?: boolean;
  /**
   * Vertical stack-print configuration (experimental). When enabled, each
   * identical-piece group exports as flipped, separated vertical stacks sized
   * to the quantity the drawer needs (× `sets`). Auto-disables snap-clip
   * connectors (dovetail/puzzle survive flipping). Omitted/undefined = no
   * stacking (single baseplate).
   */
  readonly stackPrint?: StackPrintParams;
}
