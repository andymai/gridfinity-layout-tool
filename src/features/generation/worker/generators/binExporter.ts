/**
 * Bin export — converts the last generated solid to STL or STEP format.
 */

import { unwrap, exportSTL, exportSTEP } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import type { ExportFormat, FaceGroupData } from '../../bridge/types';

import { generateBin } from './binOrchestrator';
import { getLastSolid } from './shapeCache';

/** Export result with binary data and suggested file name. */
export interface ExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
  readonly faceGroups?: readonly FaceGroupData[];
}

/**
 * Export the last generated solid in the requested format.
 * If no solid is cached (e.g., worker restarted), regenerates from params.
 *
 * STL: binary mesh with configurable tessellation quality
 * STEP: exact BREP geometry (lossless, CAD-interoperable)
 */
export async function exportBin(
  params: BinParams,
  format: ExportFormat,
  tolerance = 0.01,
  angularTolerance = 5
): Promise<ExportResult> {
  // Regenerate if no cached solid (with forExport=true for full-fidelity geometry)
  if (!getLastSolid()) {
    generateBin(params, undefined, true);
  }

  const solid = getLastSolid();
  if (!solid) {
    throw new Error('Failed to generate solid for export');
  }

  const name = `gridfinity-${params.width}x${params.depth}x${params.height}`;

  if (format === 'step') {
    const blob = unwrap(exportSTEP(solid));
    const data = await blob.arrayBuffer();
    return { data, fileName: `${name}.step` };
  }

  // STL with configurable quality
  const blob = unwrap(
    exportSTL(solid, {
      tolerance,
      angularTolerance,
      binary: true,
    })
  );
  const data = await blob.arrayBuffer();

  return { data, fileName: `${name}.stl` };
}
