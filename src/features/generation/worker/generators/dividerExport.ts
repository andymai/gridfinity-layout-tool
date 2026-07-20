/**
 * Divider export pipeline.
 *
 * Generates one divider piece per unique shape (one per enabled axis)
 * and exports them as a single STL file. Users duplicate instances
 * in their slicer as needed.
 */

import { unwrap, fuse, exportSTEP } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import type { ExportFormat, CombinedExportPiece } from '../../bridge/types';
import { GRIDFINITY } from '@/shared/constants/bin';
import { buildUniqueDividerPieces } from './dividerBuilder';
import { pitchFromParams } from './gridPitch';
import { resolveOverhang, overhangExpansion } from './overhang';
import { unwrapExportBlob } from './utils/exportUnwrap';
import { exportSolidToStl } from './utils/stlMeshFallback';

const CLEARANCE = GRIDFINITY.TOLERANCE;

/**
 * Interior dimensions the divider pieces span. Mirrors the pipeline's
 * `context.ts`: the interior grows into the overhang in lockstep with the body,
 * so pieces must span the expanded interior to reach the wall slots the body
 * cuts at those positions.
 */
export function dividerInteriorDims(params: BinParams): { innerW: number; innerD: number } {
  const { x: unitX, y: unitY } = pitchFromParams(params);
  const ovh = overhangExpansion(resolveOverhang(params.overhang));
  const outerW = params.width * unitX - CLEARANCE + ovh.addW;
  const outerD = params.depth * unitY - CLEARANCE + ovh.addD;
  return {
    innerW: outerW - 2 * params.wallThickness,
    innerD: outerD - 2 * params.wallThickness,
  };
}
const SOCKET_HEIGHT = GRIDFINITY.SOCKET_HEIGHT;

/**
 * Export unique divider piece(s) as a single STL file.
 * When both axes are enabled, two pieces (different lengths) are
 * placed side-by-side; otherwise a single piece is exported.
 */
export async function exportDividers(
  params: BinParams
): Promise<{ data: ArrayBuffer; fileName: string }> {
  const totalHeight = params.height * params.heightUnitMm;
  const isFlat = params.base.style === 'flat';
  const wallHeight = isFlat ? totalHeight : totalHeight - SOCKET_HEIGHT;

  const { innerW, innerD } = dividerInteriorDims(params);
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

/**
 * Export each divider piece separately with axis labels.
 *
 * Unlike `exportDividers()` which fuses all pieces, this returns one
 * labeled piece per enabled axis for combined bin + divider exports.
 */
export async function exportDividerPiecesSeparately(
  params: BinParams,
  format: ExportFormat,
  tolerance = 0.01,
  angularTolerance = 5
): Promise<CombinedExportPiece[]> {
  const totalHeight = params.height * params.heightUnitMm;
  const isFlat = params.base.style === 'flat';
  const wallHeight = isFlat ? totalHeight : totalHeight - SOCKET_HEIGHT;

  const { innerW, innerD } = dividerInteriorDims(params);
  const hasLip = params.base.stackingLip;

  const pieces = buildUniqueDividerPieces(params, innerW, innerD, wallHeight, hasLip);
  if (pieces.length === 0) return [];

  const results: CombinedExportPiece[] = [];
  try {
    for (const { shape, label } of pieces) {
      if (format === 'step') {
        const blob = unwrapExportBlob(exportSTEP(shape), 'STEP');
        results.push({ data: await blob.arrayBuffer(), label });
      } else {
        const data = await exportSolidToStl(shape, label, tolerance, angularTolerance);
        results.push({ data, label });
      }
    }
  } finally {
    for (const p of pieces) p.shape.delete();
  }
  return results;
}
