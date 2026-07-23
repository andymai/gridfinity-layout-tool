/** Handle-eligible wall sides (outer walls only, no interior dividers) */
export type HandleWallSide = 'front' | 'back' | 'left' | 'right';

/** Handle cutout shape */
export type HandleCutoutShape = 'rectangle' | 'oval' | 'scoop';

/** Per-side handle configuration */
export interface HandleSide {
  /** Whether this side's handle is individually enabled */
  readonly enabled: boolean;
  /** Per-side width override (% of wall span). Null = use global. */
  readonly width: number | null;
  /** Per-side height override (mm). Null = use global. */
  readonly height: number | null;
  /** Per-side corner radius override (mm). Null = use global. */
  readonly cornerRadius: number | null;
}

/** Handle configuration for through-hole grip cutouts */
export interface HandleConfig {
  /** Master toggle for the handles feature */
  readonly enabled: boolean;
  /** Cutout shape applied globally to all sides */
  readonly shape: HandleCutoutShape;
  /** Hole width as % of wall interior span (10-100). Default: 50 */
  readonly width: number;
  /** Hole height in mm (vertical extent). Default: 15 */
  readonly height: number;
  /** Corner radius in mm (0 = sharp rectangle). Default: 10. Used for rectangle only. */
  readonly cornerRadius: number;
  /** Vertical position as fraction 0-1 from floor. Default: 0.7. */
  readonly verticalPosition: number;
  /** Number of handles per wall side (1-3). Default: 1 */
  readonly count: number;
  /** Whether to enable chamfer around handle edges */
  readonly chamfer: boolean;
  /** Whether to cut handles into interior divider walls */
  readonly interior: boolean;
  readonly front: HandleSide;
  readonly back: HandleSide;
  readonly left: HandleSide;
  readonly right: HandleSide;
}
