/** Position of fractional edge when drawer has half-unit dimensions */
export type FractionalEdge = 'start' | 'end';

/**
 * One cut applied to a drawer corner — authoring parameters for the
 * corner-cuts editor, echoed inside {@link DrawerOutline.authoring} so the
 * editor can round-trip. Dimensions in mm.
 */
export type CornerCut =
  | { readonly kind: 'none' }
  | { readonly kind: 'chamfer'; readonly size: number }
  | { readonly kind: 'radius'; readonly r: number }
  | { readonly kind: 'notch'; readonly w: number; readonly d: number };

/** Per-corner cuts (tl/tr = back-left/back-right in grid coords, y up). */
export interface CornerCutParams {
  readonly tl: CornerCut;
  readonly tr: CornerCut;
  readonly bl: CornerCut;
  readonly br: CornerCut;
}

/** Which authoring surface produced an outline (round-trip hint only). */
export type OutlineAuthoringKind = 'cells' | 'corners' | 'trace' | 'pen';

/**
 * Vertex of a drawer outline. Coordinates are drawer-local mm — origin at the
 * grid's bottom-left, spanning `[0, width·gridUnitMm] × [0, depth·gridUnitMm]`.
 */
export interface OutlineVertex {
  readonly x: number;
  readonly y: number;
  /**
   * Arc bulge for the segment from this vertex to the next (DXF LWPOLYLINE
   * convention: `tan(sweep/4)`). 0/omitted = straight line. Positive = CCW
   * sweep, bowing the arc RIGHT of the travel direction — on this CCW loop,
   * away from the interior. `|bulge| ≤ 1` (arcs capped at 180°).
   */
  readonly bulge?: number;
}

/**
 * Non-rectangular drawer boundary: a single closed CCW loop of line segments
 * and circular arcs (implicitly closed last→first). Absent = full rectangle.
 *
 * The loop must be simple (non-self-intersecting), lie within the drawer's
 * grid extent, and enclose at least one grid cell of area. Interior holes are
 * unrepresentable by design (single loop). Everything downstream — placement
 * validation, hatching, baseplate generation — derives from this one field;
 * cell painting, bin-footprint tracing, corner cuts, and the pen editor are
 * authoring surfaces that write it.
 */
export interface DrawerOutline {
  /**
   * Typed as a mutable array so Immer's `WritableDraft<Layout>` keeps working
   * in store slices (the `CellMask.cells` precedent) — but callers MUST NOT
   * mutate in place: geometry helpers memoize on the outline reference.
   * Always construct a fresh outline.
   */
  readonly vertices: OutlineVertex[];
  /** Which editor wrote this outline + its params, so it can reopen in the
   * same mode. Never trusted for geometry; sanitized server-side. */
  readonly authoring?: {
    readonly kind: OutlineAuthoringKind;
    readonly corners?: CornerCutParams;
  };
}

/**
 * How far a framed {@link DrawerOutline} reaches past the padded grid extent,
 * per side in mm (each ≥ 0). Zero on every side when the perimeter fits its
 * extent. See `@/shared/utils/outlineFrame` for how it is derived and
 * `ResolvedBaseplateParams.outlineOverhang` for what consumes it (#3169).
 */
export interface OutlineOverhang {
  readonly left: number;
  readonly right: number;
  readonly front: number;
  readonly back: number;
}

/**
 * The user's tape-measure reading of the physical drawer, in mm. Kept
 * alongside the derived grid dims so the fit slack stays visible after
 * commit and the baseplate panel can pre-fill padding from it. Never
 * consulted for geometry — the grid dims stay the source of truth.
 */
export interface MeasuredDrawerMm {
  width: number; // mm
  depth: number; // mm
  height?: number; // mm
}
