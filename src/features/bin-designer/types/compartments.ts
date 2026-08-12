/** Divider configuration for compartment splitting (legacy — use CompartmentConfig) */
export interface DividerConfig {
  readonly x: number;
  readonly y: number;
  readonly thickness: number;
}

/**
 * Non-uniform compartment layout using a grid-based cell ownership model.
 *
 * The bin interior is divided into a `cols × rows` grid. Each cell is assigned
 * a compartment ID. Adjacent cells sharing the same ID form one rectangular
 * compartment. Divider walls are derived from boundaries between cells with
 * different IDs.
 *
 * Example: 3×2 grid with one 2-wide compartment on top row:
 *   cells: [0, 0, 1, 2, 3, 4]  →  row 0: [0,0,1], row 1: [2,3,4]
 *   Compartment 0 spans columns 0-1 of row 0.
 */
export interface CompartmentConfig {
  /** Number of columns along width axis (1-8) */
  readonly cols: number;
  /** Number of rows along depth axis (1-8) */
  readonly rows: number;
  /** Divider wall thickness in mm */
  readonly thickness: number;
  /**
   * Cell-to-compartment mapping, stored row-major (length = rows * cols).
   * cells[row * cols + col] = compartment ID for that cell.
   * Cells with the same ID must form a rectangle.
   */
  readonly cells: number[];
  /**
   * Optional per-compartment engraved label text, indexed by compartment ID
   * after `normalizeIds`. Empty / missing entries render no text on the tab.
   * Length need not equal compartment count; trailing slots are treated as
   * empty. Kept in lockstep with `cells` via `normalizeIdsWithRemap`.
   *
   * Element type intentionally `string[]` (not `readonly string[]`) to mirror
   * sibling `cells: number[]`. The whole `params` tree passes through Immer
   * `Draft`s, which require mutable element types.
   */
  readonly compartmentTexts?: string[];
  /**
   * Optional per-compartment swappable-label plate width overrides, in
   * standard plate units (1 | 2 | 3), indexed by compartment ID after
   * `normalizeIds`. Missing / null entries mean auto (largest standard
   * width that fits — see `planLabelSockets`). Only consulted when
   * `label.mode === 'socket'`. Kept in lockstep with `cells` via
   * `normalizeIdsWithRemap`, like `compartmentTexts`.
   *
   * Mutable element type mirrors sibling arrays (Immer `Draft` requirement).
   */
  readonly labelPlateWidths?: (number | null)[];
  /**
   * Optional per-compartment hardware icon on the swappable label plate,
   * indexed by compartment ID after `normalizeIds`. Missing / null entries
   * mean no icon. Element type is loose like the sibling arrays (persisted
   * payloads are untrusted); consumers validate against `LABEL_PLATE_ICONS`
   * via `isLabelPlateIconId` before use. Only consulted when
   * `label.mode === 'socket'`. Kept in lockstep with `cells` via
   * `normalizeIdsWithRemap`, like `compartmentTexts`.
   */
  readonly labelIcons?: (string | null)[];
  /**
   * Optional per-divider tilt overrides. Each entry shifts the endpoints of
   * one interior divider away from its axis-aligned grid position, producing
   * an angled (tapered) divider — useful for wedge-shaped compartments
   * (e.g. silverware drawer dividers that follow utensil taper).
   *
   * The override applies to the unique segment between two adjacent
   * compartments identified by `compartmentA < compartmentB` (canonical
   * ordering enforced by the validator). Dropped via
   * `remapDividerOverrides` on any cell mutation that renumbers IDs.
   */
  readonly dividerOverrides?: DividerOverride[];
  /**
   * IDs of 1×1 compartments the user explicitly drew in the Bento workspace.
   * A multi-cell compartment is intrinsically "drawn"; a unit cell is
   * indistinguishable from background grid without this marker. Indexed by
   * compartment ID after `normalizeIds`, so it must be reindexed via
   * `remapDrawnUnitCells` in lockstep with `cells` — same rule as
   * `compartmentTexts`. Absent when empty: an always-present default would
   * shift every existing design's `communityParamsFingerprint`.
   */
  readonly drawnUnitCells?: number[];
  /**
   * Off-grid stash of compartments, mirroring the layout planner's
   * `__staging__` shelf. Entries are free-floating (not ID-keyed, so they
   * escape the `normalizeIds` remap) and carry only their footprint and
   * label. Bounded by `MAX_STASH_ENTRIES` client- and server-side. Absent
   * when empty (fingerprint rule above).
   */
  readonly stash?: StashedCompartment[];
  /**
   * Optional global height (mm) for the interior divider walls. `'auto'` or
   * omitted means full interior height (below the lip taper) — the historical
   * behavior. A numeric value produces partial-height dividers that rise from
   * the floor and are truncated flat; it is clamped to
   * `[MIN_COMPARTMENT_DIVIDER_HEIGHT, interior height]` at generation.
   *
   * A numeric value below the full interior height always forces the additive
   * divider-wall path (the cut-based multi-cavity shell can't express a divider
   * that stops short of the rim). This differs from `dividerOverrides`, which
   * only fall back to the additive path for some layouts; a partial height
   * always does. A numeric value that clamps up to the full interior height is
   * treated as full and keeps the cut-path.
   */
  readonly dividerHeight?: number | 'auto';
}

/**
 * Axis-aligned footprint in grid cells for the Bento draw model.
 * Row 0 = front of the bin (bottom of the UI).
 */
export interface CellRect {
  readonly col: number;
  readonly row: number;
  readonly w: number;
  readonly h: number;
}

/**
 * One stashed compartment: a footprint waiting off-grid to be placed.
 * `label` must keep this exact field name — `collectDesignText` moderates
 * object properties by their own key, and `'label'` is already in
 * `TEXT_BEARING_KEYS`; renaming it would ship an unmoderated public surface.
 */
export interface StashedCompartment {
  /** Width in grid cells (1..MAX_COMPARTMENT_GRID). */
  readonly w: number;
  /** Depth in grid cells (1..MAX_COMPARTMENT_GRID). */
  readonly h: number;
  /** Engraved label carried with the compartment; empty/missing = none. */
  readonly label?: string;
}

/**
 * One tilted-divider override. The underlying axis-aligned divider exists
 * because two adjacent compartments share a boundary; the override shifts
 * the divider's endpoints away from that boundary line.
 *
 * Coordinate system (relative to the SEGMENT's own endpoints, not the bin
 * walls — an interior divider in a 3+row grid doesn't span the full bin):
 * - For a **vertical** divider segment (compartments stacked horizontally),
 *   `offsetStart` shifts the lower-Y endpoint of the segment in ±X;
 *   `offsetEnd` shifts the higher-Y endpoint in ±X. Positive offsets push
 *   the endpoints in the +X direction.
 * - For a **horizontal** divider segment (compartments stacked vertically),
 *   `offsetStart` shifts the lower-X endpoint in ±Y; `offsetEnd` shifts the
 *   higher-X endpoint in ±Y. Positive offsets push endpoints in +Y.
 *
 * Setting both offsets equal translates the divider without tilting it.
 * Setting `offsetEnd = -offsetStart` produces a symmetric tilt around the
 * divider midpoint.
 */
export interface DividerOverride {
  /** Lower of the two compartment IDs (canonical pair ordering). */
  readonly compartmentA: number;
  /** Higher of the two compartment IDs. Must be > compartmentA. */
  readonly compartmentB: number;
  /** Signed mm shift of the start endpoint perpendicular to the divider axis. */
  readonly offsetStart: number;
  /** Signed mm shift of the end endpoint perpendicular to the divider axis. */
  readonly offsetEnd: number;
}

/** Profile shape of a finger-scoop ramp: concave fillet or flat chamfer. */
export type ScoopStyle = 'curved' | 'straight';

/** Which interior wall the scoop ramps up to. */
export type ScoopSide = 'front' | 'back' | 'left' | 'right';

/** Scoop ramp configuration for compartment accessibility */
export interface ScoopConfig {
  readonly enabled: boolean;
  /**
   * Wall the ramp rises to. Omitted on designs saved before the side was
   * selectable, which were all front-scooped — treat undefined as 'front'.
   */
  readonly side?: ScoopSide;
  /**
   * Scoop rise up the wall in mm, or 'auto'. In auto mode the ramp is
   * proportional (run === height); 'auto' = min(compartmentSize/3, 15mm, …).
   */
  readonly radius: number | 'auto';
  /**
   * Custom run along the floor in mm. When omitted the ramp is a symmetric
   * quarter shape (run === radius) — the legacy single-value behavior.
   */
  readonly run?: number;
  /** Profile shape. Defaults to 'curved' (the legacy concave quarter arc). */
  readonly style?: ScoopStyle;
  /**
   * Ceiling (mm) the auto proportional height may reach. Defaults to
   * MAX_SCOOP_RADIUS (25); raise up to the interior height for taller scoops.
   */
  readonly autoMaxHeight?: number;
}
