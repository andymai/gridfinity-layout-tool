/**
 * Divider export pipeline.
 *
 * Generates one divider piece per unique shape (one per enabled axis)
 * and exports them as a single STL file. Users duplicate instances
 * in their slicer as needed.
 */

import { unwrap, fuse, exportSTEP } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { deriveDimensions } from './pipeline/context';
import { createLogger } from '@/core/logger';
import { isOk } from '@/core/result';
import type { ExportFormat, CombinedExportPiece } from '../../bridge/types';
import { buildUniqueDividerPieces } from './dividerBuilder';
import type { LabeledDividerPiece } from './dividerBuilder';
import type { DividerBedFit } from './dividerSeamPlan';
import { splitDividerPieceAtSeams } from './dividerSplit';
import { dividerInterior } from '@/shared/utils/slotMath';
import { unwrapExportBlob } from './utils/exportUnwrap';
import { exportSolidToStl } from './utils/stlMeshFallback';
import { EXPORT_ANGULAR_TOLERANCE_RAD } from './utils/tolerances';

const logger = createLogger('dividerExport');

/**
 * Export unique divider piece(s) as a single STL file.
 * When both axes are enabled, two pieces (different lengths) are
 * placed side-by-side; otherwise a single piece is exported.
 */
export async function exportDividers(
  params: BinParams
): Promise<{ data: ArrayBuffer; fileName: string }> {
  const { wallHeight } = deriveDimensions(params, true);

  const { innerW, innerD } = dividerInterior(params);
  const hasLip = params.base.stackingLip;

  const pieces = buildUniqueDividerPieces(params, innerW, innerD, wallHeight, hasLip).map(
    (p) => p.shape
  );

  if (pieces.length === 0) {
    throw new Error('No divider pieces to export');
  }

  // Fuse unique pieces into a single solid. Each fuse() creates a new
  // handle without disposing its inputs — explicitly free the prior
  // intermediate and the consumed piece after each step.
  //
  // nextPieceToFree tracks the first index still owned by the array: on a
  // mid-loop throw (BREP boolean failure), the finally block disposes
  // `combined` (current live fused handle) plus every piece from that
  // index onward that hasn't been consumed yet.
  let combined = pieces[0];
  let nextPieceToFree = 1;
  try {
    for (let i = 1; i < pieces.length; i++) {
      const prev = combined;
      combined = unwrap(fuse(combined, pieces[i]));
      prev.delete();
      pieces[i].delete();
      nextPieceToFree = i + 1;
    }

    const name = `gridfinity-${params.width}x${params.depth}-divider`;
    const data = await exportSolidToStl(combined, name, 0.01, 5);
    return { data, fileName: `${name}.stl` };
  } finally {
    combined.delete();
    for (let i = nextPieceToFree; i < pieces.length; i++) {
      pieces[i].delete();
    }
  }
}

interface LabeledShape {
  readonly shape: Shape3D;
  readonly label: string;
}

/**
 * A piece's parts for the bed, labeled `<label>-part-1`, `-part-2` and so on.
 * A piece whose joints cannot be cut ships whole rather than as parts that
 * cannot lock together.
 */
function piecePartsForBed(piece: LabeledDividerPiece, nozzleSizeMm?: number): LabeledShape[] {
  const split = splitDividerPieceAtSeams(piece.shape, piece.seams ?? [], nozzleSizeMm);
  if (!isOk(split)) {
    logger.warn('[exportDividerPiecesSeparately] divider left whole', {
      label: piece.label,
      error: split.error.message,
    });
    return [piece];
  }
  if (split.value.length === 1) return [piece];
  return split.value.map((shape, i) => ({ shape, label: `${piece.label}-part-${i + 1}` }));
}

/**
 * Export each divider piece separately with axis labels.
 *
 * Unlike `exportDividers()` which fuses all pieces, this returns one
 * labeled piece per enabled axis for combined bin + divider exports. With
 * `fit` (a split bin's bed), a piece longer than the bed comes back as
 * jointed parts.
 */
export async function exportDividerPiecesSeparately(
  params: BinParams,
  format: ExportFormat,
  tolerance = 0.01,
  angularTolerance = EXPORT_ANGULAR_TOLERANCE_RAD,
  fit?: DividerBedFit
): Promise<CombinedExportPiece[]> {
  const { wallHeight } = deriveDimensions(params, true);

  const { innerW, innerD } = dividerInterior(params);
  const hasLip = params.base.stackingLip;

  const pieces = buildUniqueDividerPieces(params, innerW, innerD, wallHeight, hasLip, fit);
  if (pieces.length === 0) return [];

  const labeled: LabeledShape[] = [];
  let unsplit = 0;
  const results: CombinedExportPiece[] = [];
  try {
    for (; unsplit < pieces.length; unsplit++) {
      labeled.push(...piecePartsForBed(pieces[unsplit], fit?.nozzleSizeMm));
    }
    for (const { shape, label } of labeled) {
      if (format === 'step') {
        const blob = unwrapExportBlob(exportSTEP(shape), 'STEP');
        results.push({ data: await blob.arrayBuffer(), label });
      } else {
        const data = await exportSolidToStl(shape, label, tolerance, angularTolerance);
        results.push({ data, label });
      }
    }
  } finally {
    for (const p of labeled) p.shape.delete();
    for (let i = unsplit; i < pieces.length; i++) pieces[i].shape.delete();
  }
  return results;
}
