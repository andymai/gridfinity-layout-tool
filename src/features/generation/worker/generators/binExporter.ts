/**
 * Bin export — converts the last generated solid to STL or STEP format.
 */

import { unwrap, exportSTL, exportSTEP } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import type { ExportFormat, FaceGroupData } from '../../bridge/types';

import { generateBin } from './binOrchestrator';
import { getLastSolid, isLastSolidExportQuality, setLastSolid } from './shapeCache';

/** Export result with binary data and suggested file name. */
export interface ExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
  readonly faceGroups?: readonly FaceGroupData[];
}

/**
 * Run a single export attempt against the current cached solid.
 * Regenerates first if the cache is missing or preview-quality.
 */
async function runExportAttempt(
  params: BinParams,
  format: ExportFormat,
  tolerance: number,
  angularTolerance: number,
  name: string
): Promise<ExportResult> {
  if (!isLastSolidExportQuality()) {
    generateBin(params, undefined, true);
  }

  const solid = getLastSolid();
  if (!solid) {
    throw new Error('Failed to generate solid for export');
  }

  if (format === 'step') {
    const blob = unwrap(exportSTEP(solid));
    const data = await blob.arrayBuffer();
    return { data, fileName: `${name}.step` };
  }

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

/**
 * Export the last generated solid in the requested format.
 *
 * Strategy for robustness against intermittent kernel failures (GH #1339):
 *
 * 1. **Regenerate when stale**: if the cached solid is missing or was
 *    produced by a preview pass, rebuild with `forExport=true` first.
 *    Preview passes run `mesh()` at coarse tolerance, which attaches stale
 *    triangulation to the solid that `StlAPI.Write` may then reject.
 *
 * 2. **Retry once on failure**: if the first export attempt throws (e.g.
 *    `StlAPI.Write` returns false, WASM handle corruption, any other
 *    transient kernel state), discard the cached solid and regenerate
 *    from scratch, then retry. This handles failure modes beyond the
 *    preview-quality case, which my root-cause analysis for #1339 may
 *    not fully cover.
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
  const name = `gridfinity-${params.width}x${params.depth}x${params.height}`;

  try {
    return await runExportAttempt(params, format, tolerance, angularTolerance, name);
  } catch (firstError) {
    // Discard any cached state and try once more with a completely fresh
    // solid. If this second attempt also fails, rethrow the second error
    // — it's the one the user's export was actually blocked on, and the
    // fresh-solid path gives us the cleanest diagnostic stack.
    setLastSolid(null);
    try {
      return await runExportAttempt(params, format, tolerance, angularTolerance, name);
    } catch (retryError) {
      // Attach context about the first failure so telemetry can see both.
      if (retryError instanceof Error && firstError instanceof Error) {
        retryError.cause = firstError;
      }
      throw retryError;
    }
  }
}
