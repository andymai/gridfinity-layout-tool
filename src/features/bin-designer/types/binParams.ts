import type { MagnetAnchor } from '@/core/types';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import type { CellMask } from '@/shared/utils/cellMask';
import type { BaseConfig, BinStyle } from './base';
import type { SlotConfig, DividerPieceConfig } from './dividers';
import type { CompartmentConfig, ScoopConfig } from './compartments';
import type { LabelTabConfig } from './labelTabs';
import type { HandleConfig } from './handles';
import type { WallConfig, WallPatternConfig, OverhangConfig } from './walls';
import type { SlideConfig } from './slide';
import type { FloorPatternConfig } from './floor';
import type { SplitConnectorConfig } from './splitConnector';
import type { FeatureColorConfig } from './featureColors';
import type { SurfaceTextConfig, TextStyleDefaults } from './text';
import type { LidConfig } from './lid';
import type { KnifeRestConfig } from './knifeBlock';
import type { Cutout, CutoutConfig } from './cutout';

/** Complete bin parameter set for generation */
export interface BinParams {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  /** Side the half-unit foot column sits on for fractional `width`: `'end'` (default) = right, `'start'` = left. Lets a 2.5×2 bin pick the side without rotating the print (which moves the front scoop). */
  readonly fractionalEdgeX: 'start' | 'end';
  /** Side the half-unit foot row sits on for fractional `depth`: `'end'` (default) = back, `'start'` = front. */
  readonly fractionalEdgeY: 'start' | 'end';
  /**
   * True once the user has deliberately chosen the fractional edge for that axis
   * in the designer. When a design is created from a layout bin the edge is
   * inferred from the drawer with these left `false`, so a later drawer-edge
   * change surfaces a mismatch warning; a manual toggle sets the toggled axis's
   * flag `true` and silences the warning for that axis only.
   * Per-axis so overriding X never hides a real Y mismatch. Undefined = `false`.
   */
  readonly fractionalEdgeManualX?: boolean;
  readonly fractionalEdgeManualY?: boolean;
  /** Grid unit (mm) along X / `width` (default 42); also the square grid unit when {@link gridUnitMmY} is omitted. */
  readonly gridUnitMm: number;
  /** Optional grid unit (mm) along Y / `depth` for a non-square grid (e.g. 42×22). Omitted/equal to {@link gridUnitMm} ⇒ square; only the cell pitch stretches, round features stay isotropic. */
  readonly gridUnitMmY?: number;
  /**
   * Magnet hole placement anchor. Injected from the owning layout at generation
   * time (the layout is the source of truth — see `MagnetAnchor` in
   * `@/core/types`), so bin/lid magnets stay mated with the baseplate. Undefined
   * ⇒ 'edge', the corner-tracking default; only observable at `gridUnitMm > 42`.
   */
  readonly magnetAnchor?: MagnetAnchor;
  /**
   * Print nozzle (mm) a label socket's pocket clearance scales to.
   * Like {@link magnetAnchor}, this is INJECTED transiently at generation time
   * (`withSocketNozzle`, from the live print setting) and never persisted — the
   * store's params stay nozzle-free so a printer's nozzle never syncs to other
   * devices or rides along in a shared design. Undefined ⇒ 0.4mm baseline.
   */
  readonly nozzleSizeMm?: number;
  /** Height unit size in mm (default 7mm per Gridfinity spec) */
  readonly heightUnitMm: number;
  /** Wall thickness in mm (default 1.2) */
  readonly wallThickness: number;
  readonly base: BaseConfig;
  readonly style: BinStyle;
  readonly compartments: CompartmentConfig;
  readonly scoop: ScoopConfig;
  readonly label: LabelTabConfig;
  readonly walls: WallConfig;
  /** Sliding tray: a rail on this bin plus the companion tray that rides it. */
  readonly slide: SlideConfig;
  readonly handles: HandleConfig;
  readonly slotConfig: SlotConfig;
  readonly dividerPieces: DividerPieceConfig;
  readonly inserts: Insert[];
  readonly cutouts: Cutout[];
  readonly cutoutConfig: CutoutConfig;
  /**
   * Imported STL imprint meshes, keyed by the id that `Cutout.meshId`
   * references (shape 'mesh' cutouts). Absent/empty for designs without mesh
   * imprints, so existing designs serialize byte-identically. Entries are
   * GC'd by the store when the last referencing cutout is deleted.
   */
  readonly meshAssets?: Record<string, MeshAsset>;
  readonly wallPattern: WallPatternConfig;
  /**
   * Drainage / ventilation perforation of the bin floor. The cut passes
   * through the floor slab AND the base socket under it, so holes drain instead
   * of ending in a blind pocket. Omitted on designs saved before the feature
   * existed; `migrateParams` backfills a disabled config.
   */
  readonly floorPattern?: FloorPatternConfig;
  /** Split connector config. If omitted/undefined, default split connector settings are applied (connectors enabled with defaults). */
  readonly splitConnectors?: SplitConnectorConfig;
  /** Per-feature filament color assignment for multi-color 3MF export. */
  readonly featureColors: FeatureColorConfig;
  /**
   * Design-level defaults for engraved text geometry on label tabs and
   * adjacent to cutouts. Individual instances may attach a
   * `TextStyleOverride` that selectively overrides these fields.
   */
  readonly textDefaults: TextStyleDefaults;
  /**
   * Text on exterior surfaces (lid top today; walls in a follow-up). Absent
   * for designs without surface text so they serialize byte-identically.
   */
  readonly surfaceText?: SurfaceTextConfig;
  /** Click-lock lid configuration. Lid is generated as a separate companion solid. */
  readonly lid: LidConfig;
  /**
   * Handle rest for a knife block: a saddle-topped companion solid (or an
   * integrated rear section) that carries knife handles at the height the
   * `knifeSlot` cutouts imply. Absent for designs without one so they
   * serialize byte-identically.
   */
  readonly knifeRest?: KnifeRestConfig;
  /**
   * Optional custom footprint mask (non-rectangular bins).
   *
   * When omitted or when every cell is filled, the bin is treated as a
   * rectangle and uses the rectangle code path (no perf regression).
   * When present and partial, the generator builds a polygon footprint
   * and places sockets only on filled cells. Features that cannot yet
   * operate on non-rectangular footprints (compartments, cutouts, walls,
   * handles, inserts, scoops, label tabs) are skipped.
   *
   * Stored at half-bin resolution unconditionally — a `width × depth`
   * bin has a `(2*width) × (2*depth)` mask.
   */
  readonly cellMask?: CellMask;
  /**
   * Optional per-side outward body expansion (mm) to fill a drawer-fit gap.
   * Omitted or all-zero leaves the bin on the standard rectangle path.
   * Ignored for custom-shape (`cellMask`) bins in v1.
   */
  readonly overhang?: OverhangConfig;
  /**
   * Extra exterior wall height (mm) added ABOVE the nominal bin height. The
   * outer perimeter walls and the stacking lip rise by this amount while the
   * interior floor, cutouts, compartment dividers, scoops, and label tabs stay
   * anchored at the original top plane — a "collar" of dead headroom that fully
   * encloses a tall item (e.g. one half-sunk in a cutout) and lets a stacked
   * bin rest on the raised rim without crushing the contents below (issue
   *). The bin-body mirror of {@link LidConfig.extraHeightMm}.
   *
   * Omitted or `0` reproduces the standard bin exactly (byte-identical
   * geometry). Clamped to
   * [{@link DESIGNER_CONSTRAINTS.MIN_EXTRA_WALL_HEIGHT},
   * {@link DESIGNER_CONSTRAINTS.MAX_EXTRA_WALL_HEIGHT}] on load/persistence
   * (`migrateParams`) and in server share validation; generation additionally
   * floors it at 0 and ignores non-finite values. Applies to rectangular and
   * custom-shape (`cellMask`) bins alike, since the stacking lip already lofts
   * from the footprint polygon.
   */
  readonly extraWallHeightMm?: number;
}

// Insert Types

/** Shape of a cavity cut into the bin floor */
export type InsertShape = 'rectangle' | 'circle' | 'hexagon' | 'rounded-rect' | 'slot';

/** A placed insert instance on the bin floor */
export interface Insert {
  readonly id: string;
  readonly templateId: string | null;
  readonly shape: InsertShape;
  /** X position in mm from bin interior left edge */
  readonly x: number;
  /** Y position in mm from bin interior front edge */
  readonly y: number;
  /** Width in mm (or diameter for circle/hexagon) */
  readonly width: number;
  /** Depth in mm (ignored for circle/hexagon) */
  readonly depth: number;
  /** Cavity depth in mm (how deep the cut goes) */
  readonly cutDepth: number;
  /** Rotation in degrees (0, 90, 180, 270) */
  readonly rotation: 0 | 90 | 180 | 270;
  /** Corner radius for rounded-rect shape (mm) */
  readonly cornerRadius: number;
  /** Optional label for the insert */
  readonly label: string;
}

// Cutout Types (Top-Down Cavity Cuts for Solid Bins)
