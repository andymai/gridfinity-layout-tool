/**
 * Helpers for reading a `SavedDesign` regardless of item kind. Bin designs
 * carry flat `params`; non-bin kinds carry `envelope` + `structure`.
 */
import type { BinParams, SavedDesign } from '../types';

/** True when the design is a bin (has flat `params`). */
export function isBinDesign(design: SavedDesign): design is SavedDesign & { params: BinParams } {
  return (design.kind ?? 'bin') === 'bin' && design.params !== undefined;
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
    const height = design.structure?.kind === 'importedMesh' ? design.structure.heightUnits : 0;
    return { width: design.envelope.width, depth: design.envelope.depth, height };
  }
  return { width: 0, depth: 0, height: 0 };
}
