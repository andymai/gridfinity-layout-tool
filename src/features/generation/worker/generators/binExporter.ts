/**
 * Bin export — converts the last generated solid to STL or STEP format.
 */

import { exportSTEP, mesh } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import type { ExportFormat, FaceGroupData } from '../../bridge/types';

import { generateBin } from './binOrchestrator';
import { FeatureTag } from './featureTags';
import { getLastSolid, isLastSolidReusableFor, setLastSolid } from './shapeCache';
import { paramsFingerprint } from '@/shared/generation/paramsFingerprint';
import { EXPORT_ANGULAR_TOLERANCE_RAD, EXPORT_TOLERANCE } from './utils/tolerances';
import { unwrapExportBlob } from './utils/exportUnwrap';
import { exportSolidToStl } from './utils/stlMeshFallback';
import { hasMeshImprints, prepareMeshImprints } from './meshImprint';
import { buildSTLBufferFromIndexed } from '../../export/stlExporter';
import { isWasmTrap } from '@/shared/generation/wasmTrap';

/** Export result with binary data and suggested file name. */
export interface ExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
  readonly faceGroups?: readonly FaceGroupData[];
}

/**
 * Run a single export attempt against the current cached solid, regenerating
 * first unless the cache holds an export-quality solid built from these exact
 * params.
 *
 * `faceGroups` is captured so 3MF callers can map each STL triangle to a
 * feature tag. The match relies on brepjs's shape+tolerance mesh cache: the
 * regen path runs `mesh()` at `EXPORT_TOLERANCE`/`EXPORT_ANGULAR_TOLERANCE_RAD`
 * (the export branch of `computeTessellationTolerances`), and we re-mesh /
 * `exportSTL` with the same constants here so all three calls hit the same
 * cached tessellation.
 */
async function runExportAttempt(
  params: BinParams,
  format: ExportFormat,
  name: string,
  onProgress?: (progress: number) => void
): Promise<ExportResult> {
  onProgress?.(0.02);

  // Mesh imprint designs export the imprinted MESH, never the BREP solid —
  // the pocket subtraction happens post-tessellation (meshImprintStage), so
  // `exportSolidToStl(solid, …)` would silently ship a bin without pockets.
  if (hasMeshImprints(params)) {
    if (format === 'step') {
      throw new Error(
        'STEP export is not available for designs with mesh imprint cutouts — use STL or 3MF'
      );
    }
    await prepareMeshImprints(params);
    const meshData = generateBin(params, (_stage, p) => onProgress?.(0.02 + p * 0.9), true);
    onProgress?.(0.95);
    const data = buildSTLBufferFromIndexed(
      meshData.vertices,
      meshData.normals,
      meshData.indices,
      name
    );
    onProgress?.(1);
    return { data, fileName: `${name}.stl`, faceGroups: meshData.faceGroups };
  }

  let faceGroups: readonly FaceGroupData[] | undefined;
  if (!isLastSolidReusableFor(paramsFingerprint(params))) {
    // Generation is the bulk of export → map its stage progress to 2%–85%.
    const meshData = generateBin(params, (_stage, p) => onProgress?.(0.02 + p * 0.83), true);
    faceGroups = meshData.faceGroups;
  }
  onProgress?.(0.85);

  const solid = getLastSolid();
  if (!solid) {
    throw new Error('Failed to generate solid for export');
  }

  if (format === 'step') {
    // STEP carries exact BREP geometry; faceGroups don't ride along, so
    // skip the re-mesh that the STL/3MF path needs.
    const blob = unwrapExportBlob(exportSTEP(solid), 'STEP');
    const data = await blob.arrayBuffer();
    onProgress?.(1);
    return { data, fileName: `${name}.step` };
  }

  // Cached export-quality solid — re-derive faceGroups from the brepjs mesh
  // cache so STL→3MF gets per-triangle material indices.
  if (!faceGroups) {
    const m = mesh(solid, {
      tolerance: EXPORT_TOLERANCE,
      angularTolerance: EXPORT_ANGULAR_TOLERANCE_RAD,
    });
    faceGroups = m.faceGroups.map((g) => ({
      start: g.start,
      count: g.count,
      tag: g.origin !== 0 ? g.origin : FeatureTag.UNKNOWN,
    }));
  }

  onProgress?.(0.92);
  // `faceGroups` above indexes into the same mesh() tessellation the fallback
  // writes from, so 3MF material alignment survives an OCCT-writer failure.
  const data = await exportSolidToStl(solid, name, EXPORT_TOLERANCE, EXPORT_ANGULAR_TOLERANCE_RAD);
  onProgress?.(1);
  return { data, fileName: `${name}.stl`, faceGroups };
}

/**
 * Export the last generated solid in the requested format. Tessellation is
 * fixed at `EXPORT_TOLERANCE` / `EXPORT_ANGULAR_TOLERANCE_RAD` so the faceGroups
 * captured at generation time line up with the triangles `exportSTL` emits
 * (brepjs caches `mesh()` by shape+tolerance — diverging here would silently
 * misalign per-triangle material indices in the 3MF).
 *
 * Strategy for robustness against intermittent kernel failures (GH):
 *
 * 1. **Regenerate when stale**: if the cached solid is missing, was produced
 *    by a preview pass, or belongs to a different design, rebuild with
 *    `forExport=true` first. Preview passes run `mesh()` at coarse tolerance,
 *    which attaches stale triangulation to the solid that `StlAPI.Write` may
 *    then reject; a different design's solid is simply the wrong shape, which
 * is what shipped mismatched bins in whole-layout ZIPs (GH).
 *
 * 2. **Retry once on failure**: if the first export attempt throws (e.g.
 *    `StlAPI.Write` returns false, WASM handle corruption, any other
 *    transient kernel state), discard the cached solid and regenerate
 *    from scratch, then retry. This handles failure modes beyond the
 * preview-quality case, which my root-cause analysis may
 *    not fully cover.
 *
 * STL: binary mesh at the fixed export tolerance.
 * STEP: exact BREP geometry (lossless, CAD-interoperable).
 */
export async function exportBin(
  params: BinParams,
  format: ExportFormat,
  onProgress?: (progress: number) => void
): Promise<ExportResult> {
  const name = `gridfinity-${params.width}x${params.depth}x${params.height}`;

  try {
    return await runExportAttempt(params, format, name, onProgress);
  } catch (firstError) {
    // A trap (see isWasmTrap) leaves nothing to retry on: the second attempt
    // would rerun the whole pipeline on the corrupted instance.
    if (isWasmTrap(firstError)) throw firstError;
    // Discard any cached state and try once more with a completely fresh
    // solid. If this second attempt also fails, rethrow the second error
    // — it's the one the user's export was actually blocked on, and the
    // fresh-solid path gives us the cleanest diagnostic stack.
    setLastSolid(null);
    try {
      return await runExportAttempt(params, format, name, onProgress);
    } catch (retryError) {
      // Attach context about the first failure so telemetry can see both.
      if (retryError instanceof Error && firstError instanceof Error) {
        retryError.cause = firstError;
      }
      throw retryError;
    }
  }
}
