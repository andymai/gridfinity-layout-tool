/**
 * Click-lock lid generation entry point.
 *
 * Builds the lid solid via `buildLid` and tessellates it into a MeshData
 * suitable for rendering and export. Returns null when the lid is not
 * enabled or the bin has no stacking lip (the lid mates with the lip,
 * so it's pointless without one).
 */

import { mesh, meshEdges, unwrap, exportSTL, exportSTEP } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData, ExportFormat } from '../../bridge/types';
import type { ProgressFn } from './generatorTypes';
import { buildLid } from './lidBuilder';
import { toIndexedMeshData } from './utils/mesh';
import { computeTessellationTolerances } from './utils/tolerances';
import { checkCancelled } from './meshUtils';
import { SIZE } from './generatorConstants';

export function generateLid(
  params: BinParams,
  onProgress?: ProgressFn,
  forExport = false,
  signal?: AbortSignal
): MeshData | null {
  if (!params.lid.enabled) return null;
  if (!params.base.stackingLip) return null;

  checkCancelled(signal);
  // Build the lid with face-origin → FeatureTag tracking so the rendered
  // mesh's face groups carry rail vs body provenance (used by hover-glow).
  const originToTag = new Map<number, number>();
  const solid = buildLid(params, originToTag);

  checkCancelled(signal);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive fallback for legacy params
  const gridUnit = params.gridUnitMm ?? SIZE;
  const maxDimension = Math.max(params.width, params.depth) * gridUnit;
  // Lid always has lip-mating geometry → use the "has lip" tolerance tier.
  const { tolerance, angularTolerance } = computeTessellationTolerances(
    forExport,
    true,
    maxDimension
  );

  const shapeMesh = mesh(solid, { tolerance, angularTolerance });
  const edgeMesh = meshEdges(solid, {
    tolerance,
    angularTolerance: angularTolerance * 0.5,
  });
  onProgress?.('merge', 1.0);

  return toIndexedMeshData(shapeMesh, edgeMesh.lines, originToTag);
}

/** Export result for the lid (binary STL or STEP buffer). */
export interface LidExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
}

/**
 * Export the lid in the requested format. Builds a fresh export-quality
 * solid each time. Returns null when the lid is not enabled.
 */
export async function exportLid(
  params: BinParams,
  format: ExportFormat,
  tolerance = 0.01,
  angularTolerance = 5
): Promise<LidExportResult | null> {
  if (!params.lid.enabled) return null;
  if (!params.base.stackingLip) return null;

  const solid = buildLid(params);
  const name = `gridfinity-${params.width}x${params.depth}-lid`;

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
