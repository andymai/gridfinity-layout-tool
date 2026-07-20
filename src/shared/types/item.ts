/**
 * General "Gridfinity item" model — the abstraction that a bin is one kind of.
 *
 * An item that sits on a Gridfinity baseplate is `{ envelope, structure }`:
 * - `envelope` holds concerns true of ANY such item (footprint, physical units,
 *   baseplate attachment, colors) so new kinds never redeclare them.
 * - `structure` is a discriminated union carrying only kind-specific fields.
 *
 * NOTE: `GridfinityItem` / `ItemKind` are DESIGNER-scoped. The layout domain's
 * placeable unit remains `Bin` — do not reuse `ItemKind` for layout entities.
 */
import type { BinParams, FeatureColorConfig } from '@/shared/types/bin';
import type { MeshAsset } from '@/shared/generation/meshAsset';

export type ItemKind = 'bin' | 'toolRack' | 'importedMesh';

/**
 * The baseplate-mating subset shared by every kind. For bins this is a
 * projection of `BaseConfig` (the bin path still reads `structure.base`); the
 * rack uses it as its source of truth for magnet/screw holes.
 */
export interface AttachmentConfig {
  readonly magnetHoles: boolean;
  readonly magnetDiameter: number;
  readonly magnetDepth: number;
  readonly screwHoles: boolean;
  readonly screwDiameter: number;
}

/** Concerns shared by all item kinds. */
export interface ItemEnvelope {
  /** Footprint width in grid units. */
  readonly width: number;
  /** Footprint depth in grid units. */
  readonly depth: number;
  /** Grid unit size in mm (default 42 per Gridfinity spec). */
  readonly gridUnitMm: number;
  /** Height unit size in mm (default 7 per Gridfinity spec). */
  readonly heightUnitMm: number;
  readonly attachment: AttachmentConfig;
  readonly featureColors: FeatureColorConfig;
}

/** Fields hoisted from `BinParams` into the shared envelope. */
export type EnvelopeOwnedBinKeys =
  'width' | 'depth' | 'gridUnitMm' | 'heightUnitMm' | 'featureColors';

/** Bin structure = today's BinParams minus the envelope-owned fields, tagged. */
export type BinStructure = Omit<BinParams, EnvelopeOwnedBinKeys> & {
  readonly kind: 'bin';
};

/** A slanted tool rack: angled fins on a floor plate over a socket base. */
export interface ToolRackStructure {
  readonly kind: 'toolRack';
  /** Floor plate thickness in mm. */
  readonly floorThickness: number;
  /** Fin lean-back from vertical in degrees (0..45 for printability). */
  readonly finAngleDeg: number;
  /** Fin wall thickness in mm. */
  readonly finThickness: number;
  /** Fin vertical rise in mm. */
  readonly finHeight: number;
  /** Explicit fin count; when omitted, derived from `slotPitch` and width. */
  readonly finCount?: number;
  /** Center-to-center fin spacing in mm; used when `finCount` is omitted. */
  readonly slotPitch?: number;
  /** Margin in mm from footprint edge to first/last fin. */
  readonly slotInsetMm: number;
  readonly backRail: {
    readonly enabled: boolean;
    readonly height: number;
    readonly thickness: number;
  };
  /** Uniform outer corner radius of the floor plate in mm. */
  readonly cornerRadius?: number;
}

/**
 * A bin imported from an STL file: the stored mesh IS the geometry. Immutable
 * apart from the claimed grid footprint (envelope width/depth + `heightUnits`),
 * which the user can override when auto-detection reads an off-grid model.
 */
export interface ImportedMeshStructure {
  readonly kind: 'importedMesh';
  /**
   * Claimed height in Gridfinity height units (totalH ≈ heightUnits ×
   * `envelope.heightUnitMm`). Drives layout stacking/blocked zones, never
   * rescales the mesh.
   */
  readonly heightUnits: number;
  /** Compressed GMA1 mesh + metadata (name, triangleCount, sizeMm, outlines). */
  readonly asset: MeshAsset;
  /** Solid volume in mm³ measured at import time; powers filament estimates. */
  readonly volumeMm3?: number;
  /** Original STL file name for provenance display. */
  readonly sourceFileName?: string;
}

export type ItemStructure = BinStructure | ToolRackStructure | ImportedMeshStructure;

export interface GridfinityItem {
  readonly envelope: ItemEnvelope;
  readonly structure: ItemStructure;
}

/** Narrow a `GridfinityItem` to a specific kind (type guard). */
export function isItemKind<K extends ItemKind>(
  item: GridfinityItem,
  kind: K
): item is GridfinityItem & { structure: Extract<ItemStructure, { kind: K }> } {
  return item.structure.kind === kind;
}
