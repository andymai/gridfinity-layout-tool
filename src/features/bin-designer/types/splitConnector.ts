/**
 * Style of alignment connector added to the exterior side walls at each cut.
 * `'none'` disables wall connectors; `'key'` is the press-together alignment key.
 * Extend this union (and the dispatcher in `splitConnectorBuilder.ts`) to add
 * new wall connector types — the dispatcher's exhaustive switch will flag every
 * place that must handle the new member.
 */
export type WallConnectorStyle = 'none' | 'key';

/** Configuration for alignment connectors on split bin cut faces */
export interface SplitConnectorConfig {
  /** Whether to add alignment connectors (default: true when split needed) */
  readonly enabled: boolean;
  /** FDM fit clearance applied to groove/channel dimensions per side, normal to surface (mm, 0.05–0.3) */
  readonly clearance: number;
  /** Legacy tongue protrusion depth; kept for backward compat, unused by current scarf lap (mm) */
  readonly tongueProtrusion: number;
  /** Tongue cross-section thickness — kept for backward compat, unused by scarf lap (mm) */
  readonly tongueThickness: number;
  /** Wall connector style added to exterior side walls at each cut (default: 'none'). */
  readonly wallConnector?: WallConnectorStyle;
  /**
   * Reserved: nominal key width hint as a fraction of wall thickness. Actual width is
   * clamped to the FDM minimum and driven by the local pilaster, since raw thin walls
   * (≈1.2mm) yield sub-printable widths.
   */
  readonly ridgeWidthFraction?: number;
  /**
   * Wall key height as a fraction of interior wall height (default 0.8). The key
   * stops below the rim so it never collides with the stacking lip.
   */
  readonly ridgeHeightFraction?: number;
  /**
   * Nozzle diameter (mm) the pieces will be printed with. Connector/wall-key
   * feature sizes and fit clearances scale up with it so they stay printable on
   * wider nozzles. Omitted/undefined is treated as the 0.4mm baseline, leaving
   * geometry identical to pre-nozzle-aware behavior. The shared value lives in
   * `settings.printSettings.nozzleSizeMm`; this carries a copy to the worker.
   */
  readonly nozzleSizeMm?: number;
}
