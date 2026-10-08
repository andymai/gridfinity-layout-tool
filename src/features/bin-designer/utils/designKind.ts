/**
 * Helpers for reading a `SavedDesign` regardless of item kind. Bin designs
 * carry flat `params`; non-bin kinds carry `envelope` + `structure`.
 */
import type { BinParams, SavedDesign } from '../types';
import { assemblyHeightUnits } from '@/shared/types/assemblyPlacement';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';

/** The fields that decide a design's kind. A version's content carries the same set. */
type DesignKindFields = Pick<SavedDesign, 'kind' | 'params' | 'envelope' | 'structure'>;

/** True when the design is a bin (has flat `params`). */
export function isBinDesign<T extends DesignKindFields>(
  design: T
): design is T & { params: BinParams } {
  return (design.kind ?? 'bin') === 'bin' && design.params !== undefined;
}

/**
 * Kinds cloud sync carries: bins, Workshop assemblies and imported meshes,
 * whose mesh travels as a ref to a stored file. Legacy tool racks stay local.
 */
export function isSyncableDesign(design: DesignKindFields): boolean {
  if (isBinDesign(design)) return true;
  if (design.envelope === undefined) return false;
  const structureKind = design.structure?.kind;
  return (
    (design.kind === 'assembly' && structureKind === 'assembly') ||
    (design.kind === 'importedMesh' && structureKind === 'importedMesh')
  );
}

/** Kinds that can stand on the layout grid as a bin: parametric bins,
 *  imported meshes, and Workshop assemblies (socketed base, so they seat and
 *  collide like a bin). Legacy tool racks stay out — the migration converts
 *  them to assemblies. */
export function isLayoutPlaceableDesign(design: SavedDesign): boolean {
  return (
    isBinDesign(design) ||
    design.structure?.kind === 'importedMesh' ||
    (design.structure?.kind === 'assembly' && design.envelope !== undefined)
  );
}

export interface DesignFootprint {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

/** Display footprint (grid units) for any kind; height is 0 for non-bin items
 *  without a claimed height (imported meshes claim one via `heightUnits`). */
export function designFootprint(design: SavedDesign): DesignFootprint {
  if (design.params) {
    return { width: design.params.width, depth: design.params.depth, height: design.params.height };
  }
  if (design.envelope) {
    const structure = design.structure;
    const height =
      structure?.kind === 'importedMesh'
        ? structure.heightUnits
        : structure?.kind === 'assembly'
          ? assemblyHeightUnits(
              structure,
              design.envelope.heightUnitMm,
              GRIDFINITY_SPEC.SOCKET_HEIGHT + structure.base.floorThickness,
              {
                w: design.envelope.width * design.envelope.gridUnitMm,
                d: design.envelope.depth * design.envelope.gridUnitMm,
              }
            )
          : 0;
    return { width: design.envelope.width, depth: design.envelope.depth, height };
  }
  return { width: 0, depth: 0, height: 0 };
}
