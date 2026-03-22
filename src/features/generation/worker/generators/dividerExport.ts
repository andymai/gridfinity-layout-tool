/**
 * Divider export pipeline.
 *
 * Generates one divider piece per unique shape (one per enabled axis)
 * and exports them as a single STL file. Users duplicate instances
 * in their slicer as needed.
 */

import { unwrap, fuse, exportSTL } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { GRIDFINITY } from '@/shared/constants/bin';
import { buildUniqueDividerPieces } from './dividerBuilder';

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
  const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;
  const wallHeight = totalHeight - SOCKET_HEIGHT;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive fallback for backwards compatibility
  const gridUnitMm = params.gridUnitMm ?? GRIDFINITY.GRID_SIZE;
  const outerW = params.width * gridUnitMm - CLEARANCE;
  const outerD = params.depth * gridUnitMm - CLEARANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const hasLip = params.base.stackingLip;

  const pieces = buildUniqueDividerPieces(params, innerW, innerD, wallHeight, hasLip);

  if (pieces.length === 0) {
    throw new Error('No divider pieces to export');
  }

  // Fuse unique pieces into a single solid
  let combined = pieces[0];
  for (let i = 1; i < pieces.length; i++) {
    combined = unwrap(fuse(combined, pieces[i]));
  }

  const blob = unwrap(
    exportSTL(combined, {
      tolerance: 0.01,
      angularTolerance: 5,
      binary: true,
    })
  );
  const data = await blob.arrayBuffer();

  const name = `gridfinity-${params.width}x${params.depth}-divider`;
  return { data, fileName: `${name}.stl` };
}
