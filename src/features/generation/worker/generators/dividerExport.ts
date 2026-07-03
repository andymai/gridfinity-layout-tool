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
import { unwrapExportBlob } from './utils/exportUnwrap';
import { exportSolidToStl } from './utils/stlMeshFallback';

const CLEARANCE = GRIDFINITY.TOLERANCE;
const SOCKET_HEIGHT = GRIDFINITY.SOCKET_HEIGHT;

/**
 * Export unique divider piece(s) as a single STL file.
 * When both axes are enabled, two pieces (different lengths) are
 * placed side-by-side; otherwise a single piece is exported.
 */
export async function exportDividers(
  params: BinParams
): Promise<{ data: ArrayBuffer; fileName: string }> {
  const wallThickness = params.wallThickness;
  const totalHeight = params.height * params.heightUnitMm;
  const isFlat = params.base.style === 'flat';
  const wallHeight = isFlat ? totalHeight : totalHeight - SOCKET_HEIGHT;

  // Y axis uses gridUnitMmY when set (non-square grid); equal to X for square.
  const { x: unitX, y: unitY } = pitchFromParams(params);
  const outerW = params.width * unitX - CLEARANCE;
  const outerD = params.depth * unitY - CLEARANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const hasLip = params.base.stackingLip;

  const pieces = buildUniqueDividerPieces(params, innerW, innerD, wallHeight, hasLip);

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
  const wallThickness = params.wallThickness;
  const totalHeight = params.height * params.heightUnitMm;
  const isFlat = params.base.style === 'flat';
  const wallHeight = isFlat ? totalHeight : totalHeight - SOCKET_HEIGHT;

  // Y axis uses gridUnitMmY when set (non-square grid); equal to X for square.
  const { x: unitX, y: unitY } = pitchFromParams(params);
  const outerW = params.width * unitX - CLEARANCE;
  const outerD = params.depth * unitY - CLEARANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const hasLip = params.base.stackingLip;

  const pieces = buildUniqueDividerPieces(params, innerW, innerD, wallHeight, hasLip);
  if (pieces.length === 0) return [];

  // Build axis labels matching piece order from buildUniqueDividerPieces
  const labels: string[] = [];
  if (params.slotConfig.x.enabled) labels.push('divider-horizontal');
  if (params.slotConfig.y.enabled) labels.push('divider-vertical');

  const results: CombinedExportPiece[] = [];
  try {
    for (let i = 0; i < pieces.length; i++) {
      if (format === 'step') {
        const blob = unwrapExportBlob(exportSTEP(pieces[i]), 'STEP');
        results.push({ data: await blob.arrayBuffer(), label: labels[i] });
      } else {
        const data = await exportSolidToStl(pieces[i], labels[i], tolerance, angularTolerance);
        results.push({ data, label: labels[i] });
      }
    }
  } finally {
    for (const p of pieces) p.delete();
  }
  return results;
}
