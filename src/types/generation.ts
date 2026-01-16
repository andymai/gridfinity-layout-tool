/**
 * Generation Types for Drawer-to-Print Feature
 *
 * These types define the data model for STL generation, custom model import,
 * and baseplate configuration. They extend the core Layout/Bin types without
 * breaking backward compatibility.
 */

// =============================================================================
// Bin Source & Style
// =============================================================================

/**
 * Where the STL for this bin comes from.
 *
 * - generated: STL created from BinGenerationParams (parametric generation)
 * - imported: User-uploaded custom STL file
 * - library: Selected from built-in template library
 */
export type BinSource = 'generated' | 'imported' | 'library';

/**
 * Bin generation style - affects geometry profile
 *
 * - standard: Full Gridfinity spec with all features
 * - lite: Lightweight, faster print, thinner walls
 * - solid: No internal cavity (for items needing full support)
 * - vase: Vase mode compatible (single wall spiral)
 */
export type BinStyle = 'standard' | 'lite' | 'solid' | 'vase';

/** Lip style for stacking compatibility */
export type LipStyle = 'standard' | 'reduced' | 'none';

// =============================================================================
// Divider Configuration
// =============================================================================

/**
 * Divider height/shape style
 *
 * - full: Dividers extend to full bin height
 * - partial: Dividers are shorter (controlled by heightRatio)
 * - finger: Scalloped dividers for easy access
 * - none: No dividers
 */
export type DividerStyle = 'full' | 'partial' | 'finger' | 'none';

export interface DividerConfig {
  /**
   * Number of compartments along X axis (1-7).
   * Matches gridfinity-rebuilt 'divx' parameter.
   * - 1 = no dividers (single compartment)
   * - 2 = one divider (2 compartments)
   * - 3 = two dividers (3 compartments)
   */
  compartmentsX: number;
  /**
   * Number of compartments along Y axis (1-7).
   * Matches gridfinity-rebuilt 'divy' parameter.
   * - 1 = no dividers (single compartment)
   * - 2 = one divider (2 compartments)
   * - 3 = two dividers (3 compartments)
   */
  compartmentsY: number;
  /** Divider height/shape style */
  style: DividerStyle;
  /** For 'partial' style: height as ratio of bin height (0-1, default: 1) */
  heightRatio?: number;
}

// =============================================================================
// Scoop Configuration
// =============================================================================

/** Which side of the bin has a scoop */
export type ScoopSide = 'front' | 'back' | 'left' | 'right';

export interface ScoopConfig {
  enabled: boolean;
  /**
   * Scoop intensity (0-1). Higher values = deeper scoop.
   * - 0 = minimal scoop (shallow finger groove)
   * - 0.5 = medium scoop (typical default)
   * - 1 = maximum scoop (deep cut reaching near bin floor)
   *
   * Matches gridfinity-rebuilt-openscad "scoop_weight" parameter.
   */
  weight: number;
  /** Which sides have scoops (typically just 'front') */
  sides: ScoopSide[];
}

// =============================================================================
// Label Tab Configuration
// =============================================================================

/**
 * Label tab position style
 *
 * Matches gridfinity-rebuilt 'style_tab' parameter.
 * - full: Label spans full bin width (style_tab=0)
 * - auto: Automatic positioning based on bin size (style_tab=1)
 * - left: Left-aligned label tab (style_tab=2)
 * - center: Centered label tab (style_tab=3)
 * - right: Right-aligned label tab (style_tab=4)
 * - none: No label tab (style_tab=5)
 */
export type LabelStyle = 'full' | 'auto' | 'left' | 'center' | 'right' | 'none';

export interface LabelConfig {
  enabled: boolean;
  style: LabelStyle;
  /** Label tab angle in degrees (default: 45) */
  angleDeg?: number;
  /** Label depth override in mm */
  depthMm?: number;
}

// =============================================================================
// Base Hole Configuration (Magnets & Screws)
// =============================================================================

/**
 * Base hole style - matches gridfinity-rebuilt 'style_hole' parameter.
 *
 * - none: No holes (style_hole=0)
 * - magnet: Magnet holes only (style_hole=1)
 * - magnet-screw: Magnet holes with screw holes (style_hole=2)
 * - magnet-slit: Magnet holes with printability slit for supportless printing (style_hole=3)
 */
export type HoleStyle = 'none' | 'magnet' | 'magnet-screw' | 'magnet-slit';

/**
 * Hole positions on the bin base
 *
 * - all: Holes at all standard positions (4 per grid unit for rotation compatibility)
 * - corners: Holes only at bin corners
 */
export type HolePosition = 'all' | 'corners';

export interface MagnetConfig {
  enabled: boolean;
  position: HolePosition;
  /** Magnet diameter in mm (default: 6, per Gridfinity spec) */
  diameterMm: number;
  /** Magnet height in mm (default: 2, per Gridfinity spec) */
  heightMm: number;
  /**
   * Add printability slit for supportless printing.
   * Creates a small gap so the hole can bridge without supports.
   */
  printabilitySlit?: boolean;
}

export interface ScrewConfig {
  enabled: boolean;
  position: HolePosition;
  /**
   * Screw hole diameter in mm.
   * - 3.0mm: Standard M3 clearance
   * - 4.2mm: For M3 heat-set inserts
   */
  diameterMm: number;
}

// =============================================================================
// Composite Bin Generation Parameters
// =============================================================================

/**
 * How bin height is specified.
 * Matches gridfinity-rebuilt 'gridz_define' parameter.
 *
 * - units: Height in 7mm increments (gridz_define=0, default)
 * - internal-mm: Internal usable depth in mm (gridz_define=1)
 * - external-mm: Total external height in mm (gridz_define=2)
 */
export type HeightMode = 'units' | 'internal-mm' | 'external-mm';

/** Complete set of parameters for generating a bin STL */
export interface BinGenerationParams {
  style: BinStyle;
  lip: LipStyle;
  dividers?: DividerConfig;
  scoop?: ScoopConfig;
  label?: LabelConfig;
  magnets?: MagnetConfig;
  screws?: ScrewConfig;
  /**
   * How to interpret the bin height value.
   * Default: 'units' (7mm increments)
   */
  heightMode?: HeightMode;
  /** Override default wall thickness in mm (typically 1.2) */
  wallThicknessMm?: number;
}

// =============================================================================
// Bin Model Configuration
// =============================================================================

/**
 * Links a Bin to its STL generation/source configuration.
 * This is the optional field added to the Bin interface.
 */
export interface BinModelConfig {
  source: BinSource;

  /** For 'generated' bins: full generation parameters */
  params?: BinGenerationParams;

  /** For 'imported' bins: UUID reference to stored custom model in IndexedDB */
  customModelId?: string;

  /** For 'library' bins: built-in template identifier */
  templateId?: string;
  /** For 'library' bins: parameter overrides applied on top of template defaults */
  templateOverrides?: Partial<BinGenerationParams>;
}

// =============================================================================
// Baseplate Configuration
// =============================================================================

/**
 * Baseplate structural style
 *
 * - weighted: Thick, heavy baseplate for stability
 * - lite: Thin, lightweight, faster to print
 * - magnetic: Optimized for magnet mounting
 * - screw: Includes screw mounting holes
 */
export type BaseplateStyle = 'weighted' | 'lite' | 'magnetic' | 'screw';

/**
 * How to handle the gap between grid edge and drawer wall
 *
 * - solid: Thick baseplate edge fills the gap
 * - half-bin: Generate 0.5-unit edge pieces if gap is ~21mm
 * - none: Leave empty space between grid and drawer wall
 */
export type MarginType = 'solid' | 'half-bin' | 'none';

/** Edge identifiers for per-edge configuration */
export type EdgeSide = 'left' | 'right' | 'front' | 'back';

/** Per-edge margin configuration */
export interface EdgeMargins {
  /** Left edge (X=0) */
  left: MarginType;
  /** Right edge (X=max) */
  right: MarginType;
  /** Front edge (Y=0, bottom in UI) */
  front: MarginType;
  /** Back edge (Y=max, top in UI) */
  back: MarginType;
}

/**
 * Complete baseplate configuration for a layout.
 *
 * Baseplates are generated based on physical drawer dimensions (in mm),
 * which may differ from the grid-based Drawer dimensions used for bin layout.
 */
export interface BaseplateConfig {
  enabled: boolean;

  // Physical drawer dimensions (actual mm, may differ from grid × 42mm)
  /** Actual drawer interior width in mm (typically 50-2000mm) */
  physicalWidthMm: number;
  /** Actual drawer interior depth in mm (typically 50-2000mm) */
  physicalDepthMm: number;

  // Style and features
  style: BaseplateStyle;
  magnetHoles: boolean;
  screwHoles: boolean;

  // Gap handling
  /** How to handle the gap between grid and drawer edges, per side */
  edgeMargins: EdgeMargins;

  // Note: Subdivision strategy and joint style are export-time options,
  // not persisted in the layout configuration.
}

// =============================================================================
// Generation Defaults (Layout-level)
// =============================================================================

/**
 * Default generation settings applied to new bins in a layout.
 * Individual bins can override these via their modelConfig.
 */
export interface GenerationDefaults {
  binStyle: BinStyle;
  lip: LipStyle;
  dividers: DividerConfig;
  scoop: ScoopConfig;
  label: LabelConfig;
  magnets: MagnetConfig;
}

// =============================================================================
// Custom Model Types
// =============================================================================

/**
 * Compatibility warning for imported custom STL models.
 * Helps users understand if their model will work well in Gridfinity layouts.
 */
export type CompatibilityWarning =
  | {
      type: 'non-integer-size';
      axis: 'x' | 'y' | 'z';
      actualMm: number;
      nearestGridUnits: number;
    }
  | { type: 'no-stacking-lip' }
  | { type: 'no-base-profile' }
  | {
      type: 'oversized';
      dimension: 'width' | 'depth';
      actualMm: number;
      maxPrintBedMm: number;
    }
  | { type: 'non-manifold' };

/**
 * Metadata for a custom STL model uploaded by the user.
 * The actual STL binary data is stored separately in IndexedDB.
 */
export interface CustomModelMetadata {
  id: string;
  name: string;
  /** Unix timestamp of upload */
  uploadedAt: number;
  source: 'file' | 'url';

  // Detected properties from STL analysis
  /** Detected grid size (rounded to nearest units) */
  gridSize: { width: number; depth: number; height: number };
  /** Whether dimensions align well to Gridfinity grid */
  isGridCompatible: boolean;
  /** Specific compatibility issues found */
  compatibilityWarnings: CompatibilityWarning[];

  // File metadata
  originalFilename?: string;
  sourceUrl?: string;
  fileSizeBytes: number;
  triangleCount: number;
}

// =============================================================================
// Export-time Options (not persisted in Layout)
// =============================================================================

/**
 * Joint style for baseplate tiles (chosen at export time).
 *
 * - interlocking: Puzzle-piece edges for mechanical connection
 * - tongue-groove: Tongue and groove joints
 * - butt: Simple flat edges (tiles just sit next to each other)
 * - none: No joint features
 */
export type BaseplateJointStyle = 'interlocking' | 'tongue-groove' | 'butt' | 'none';

/**
 * Subdivision strategy for large baseplates (chosen at export time).
 *
 * - auto: Automatically subdivide to fit print bed
 * - fewer-parts: Minimize number of pieces (larger pieces where possible)
 * - uniform: All pieces same size (may result in more pieces)
 * - none: Don't subdivide (may exceed print bed)
 */
export type SubdivisionStrategy = 'auto' | 'fewer-parts' | 'uniform' | 'none';

/**
 * Options presented in the export dialog, not persisted with layout.
 */
export interface BaseplateExportOptions {
  jointStyle: BaseplateJointStyle;
  subdivisionStrategy: SubdivisionStrategy;
  /** Print bed size for subdivision calculations */
  printBedMm: number;
}

// =============================================================================
// Gridfinity Specification Constants
// =============================================================================

/**
 * Official Gridfinity specification dimensions.
 * These are fixed values from the Gridfinity spec, not user-configurable.
 *
 * @see https://gridfinity.xyz/specification/
 * @see https://github.com/gridfinity-unofficial/specification
 */
export const GRIDFINITY_SPEC = {
  /** Grid unit size in mm (42mm × 42mm) */
  gridUnitMm: 42,
  /** Height unit in mm (7mm increments) */
  heightUnitMm: 7,
  /** Bin tolerance - bins are 41.5mm to fit 42mm baseplate */
  binToleranceMm: 0.5,
  /** Baseplate corner fillet radius in mm */
  baseplateCornerRadiusMm: 4.0,
  /** Bin corner fillet radius in mm */
  binCornerRadiusMm: 3.75,
  /** Height used by bin base profile (mm) - leaves 2.25mm usable in first height unit */
  binBaseHeightMm: 4.75,
  /** Standard magnet diameter in mm */
  magnetDiameterMm: 6,
  /** Standard magnet height in mm */
  magnetHeightMm: 2,
  /** Standard screw size */
  screwSize: 'M3' as const,
  /** Standard M3 clearance hole diameter in mm */
  screwHoleDiameterMm: 3.0,
  /** M3 heat-set insert hole diameter in mm */
  heatSetInsertHoleDiameterMm: 4.2,
} as const;

/** Type for GRIDFINITY_SPEC for use in type contexts */
export type GridfinitySpec = typeof GRIDFINITY_SPEC;
