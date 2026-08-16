/**
 * Click-lock lid generation entry point.
 *
 * Builds the lid solid via `buildLid` and tessellates it into a LidMeshData
 * suitable for rendering and export. Returns null when `shouldGenerateLid`
 * rejects (lid disabled, no stacking lip, or a blocker is active).
 */

import { mesh, meshEdges, getKernelCapabilities, rotate, exportSTEP } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import type { LidMeshData, StackPlateMeshData, ExportFormat } from '../../bridge/types';
import type { ProgressFn } from './generatorTypes';
import { buildLid, buildStackPlate } from './lidBuilder';
import { toIndexedMeshData, creaseEdges } from './utils';
import { EDGE_ANGULAR_TOLERANCE_RAD } from '@/shared/constants/tessellation';
import { computeTessellationTolerances } from './utils/tolerances';
import { checkCancelled } from './meshUtils';
import { shouldGenerateLid } from '@/shared/types/bin';
import { unwrapExportBlob } from './utils/exportUnwrap';
import { exportSolidToStl } from './utils/stlMeshFallback';
import { FeatureTag } from './featureTags';
import type { FaceGroupData } from '@/shared/types/generation';

/**
 * Rotate the lid 180° around the X axis so the floor's outer surface
 * faces DOWN (sits on the slicer's build plate) and the mating shell
 * + click rails face UP. This converts the lid's downward-facing
 * mating-cavity overhang into a plain upward-opening pocket and the
 * rails into vertical-wall details — both print without supports.
 *
 * Applied only on the standalone export path (`exportLid`), NOT on
 * the STEP compound assembly path in `exportHandler` where the lid
 * must remain in mating orientation to nest correctly above the bin.
 *
 * Caller owns the returned solid; this function deletes the input even if
 * the rotation throws (otherwise an OCCT failure would leak the input).
 */
function orientForPrint(lidSolid: Shape3D): Shape3D {
  try {
    const oriented = rotate(lidSolid, 180, { axis: [1, 0, 0] });
    lidSolid.delete();
    return oriented;
  } catch (err) {
    lidSolid.delete();
    throw err;
  }
}

/**
 * Whether the lid should keep its natural (unflipped) orientation on export.
 *
 * A tray recess lives on the top face and the mating cavity on the underside;
 * they want opposite print orientations and one side needs supports
 * (decision D1, "auto by attachment"). Click-rail lids always flip so the rails
 * print clean (the tray then needs supports); friction/magnetic tray lids skip
 * the flip so the tray prints clean (the gentler cavity/magnet overhang takes
 * the supports). Non-tray lids always flip, as before.
 */
function keepsNaturalOrientation(params: BinParams): boolean {
  const trayActive = params.lid.tray.enabled && !params.lid.stackableTop;
  return trayActive && params.lid.attachment !== 'clickRails';
}

export function generateLid(
  params: BinParams,
  onProgress?: ProgressFn,
  forExport = false,
  signal?: AbortSignal
): LidMeshData | null {
  if (!shouldGenerateLid(params)) return null;

  checkCancelled(signal);
  // Build the lid with face-origin → FeatureTag tracking so the rendered
  // mesh's face groups carry rail vs body provenance (used by hover-glow).
  const originToTag = new Map<number, number>();
  const solid = buildLid(params, originToTag);

  // `buildLid` returns a caller-owned WASM solid; once we've tessellated
  // it into JS-side mesh data, the OCCT shape is no longer needed and
  // must be `.delete()`'d or it leaks into the WASM heap (every param
  // change runs `generateLid`, so this would accumulate quickly). The
  // try/finally pattern mirrors `baseplateGenerator`'s lifecycle.
  try {
    checkCancelled(signal);
    // Per-axis extent (Y uses gridUnitMmY on non-square grids) so the
    // tessellation tolerance scales to the true largest dimension.
    const maxDimension = Math.max(
      params.width * params.gridUnitMm,
      params.depth * (params.gridUnitMmY ?? params.gridUnitMm)
    );
    // Lid always has lip-mating geometry → use the "has lip" tolerance tier.
    const { tolerance, angularTolerance } = computeTessellationTolerances(
      forExport,
      true,
      maxDimension
    );

    const shapeMesh = mesh(solid, { tolerance, angularTolerance });
    const buildTime = getKernelCapabilities().tessellationModel === 'build-time';
    const edgeLines = buildTime
      ? creaseEdges(shapeMesh)
      : meshEdges(solid, { tolerance, angularTolerance: EDGE_ANGULAR_TOLERANCE_RAD }).lines;
    onProgress?.('merge', 1.0);

    return toIndexedMeshData(shapeMesh, edgeLines, originToTag);
  } finally {
    solid.delete();
  }
}

/**
 * Tessellate the standalone stack-grid baseplate into mesh data for the
 * preview. Returns null unless the lid opts into `separateStackPlate` (via
 * `buildStackPlate`) and `shouldGenerateLid` passes.
 *
 * Built in lid-local coords (slab Z ∈ [0, SOCKET_HEIGHT], Z=0 = glue face) so
 * the preview can float it above the lid at the same lid-local frame. No
 * reorientation — that's an export-only concern for the lid, and the slab is
 * already print-ready.
 */
export function generateStackPlate(
  params: BinParams,
  signal?: AbortSignal
): StackPlateMeshData | null {
  if (!shouldGenerateLid(params)) return null;

  checkCancelled(signal);
  const solid = buildStackPlate(params);
  if (!solid) return null;

  // Same WASM-heap discipline as `generateLid`: release the OCCT solid once
  // tessellated, or it leaks on every param change.
  try {
    checkCancelled(signal);
    const maxDimension = Math.max(
      params.width * params.gridUnitMm,
      params.depth * (params.gridUnitMmY ?? params.gridUnitMm)
    );
    // The slab's only curved detail is the pocket tapers; use the fine ("has
    // lip") tier so they read smoothly — the mesh is small, so cost is trivial.
    const { tolerance, angularTolerance } = computeTessellationTolerances(
      false,
      true,
      maxDimension
    );

    const shapeMesh = mesh(solid, { tolerance, angularTolerance });
    const buildTime = getKernelCapabilities().tessellationModel === 'build-time';
    const edgeLines = buildTime
      ? creaseEdges(shapeMesh)
      : meshEdges(solid, { tolerance, angularTolerance: EDGE_ANGULAR_TOLERANCE_RAD }).lines;

    const indexed = toIndexedMeshData(shapeMesh, edgeLines);
    return {
      vertices: indexed.vertices,
      normals: indexed.normals,
      indices: indexed.indices,
      edgeVertices: indexed.edgeVertices,
      triangleCount: indexed.triangleCount,
    };
  } finally {
    solid.delete();
  }
}

/** Export result for the lid (binary STL or STEP buffer). */
export interface LidExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
  /**
   * Per-triangle provenance for the exported STL, in the SAME tessellation the
   * bytes were written from. Lets the 3MF assembler paint the lid's own lip
   * (`FeatureTag.LID_LIP`) separately from its shell instead of shipping the
   * whole object in one colour. Absent for STEP, which carries exact BREP
   * geometry with no triangle list to index.
   */
  readonly faceGroups?: readonly FaceGroupData[];
}

/**
 * Export the lid in the requested format. Builds a fresh export-quality
 * solid each time. Returns null when `shouldGenerateLid` rejects.
 *
 * Format convention (matches `exportDividerPiecesSeparately`): only
 * `'step'` returns a STEP buffer with a `.step` filename. Every other
 * format — including `'3mf'` — returns binary-STL bytes with a `.stl`
 * filename. The worker never produces 3MF directly; main-thread code
 * (`exportHandler.handleExportCombined`'s STL/3MF path) collects the
 * STL pieces and assembles the 3MF zip there. Today's only caller
 * discards `fileName` and uses a label, so the .stl extension is
 * harmless; the convention is documented here so a future caller
 * doesn't trip over the apparent format/filename mismatch.
 */
export async function exportLid(
  params: BinParams,
  format: ExportFormat,
  tolerance = 0.01,
  angularTolerance = 5
): Promise<LidExportResult | null> {
  if (!shouldGenerateLid(params)) return null;

  // Tray friction/magnetic lids export tray-up (unflipped) so the recess
  // prints clean; everything else flips floor-down for a support-free cavity.
  // Tagged build: the export path previously discarded provenance, so the lid
  // could only ever be painted as one flat colour.
  const originToTag = new Map<number, number>();
  const built = buildLid(params, originToTag);
  const solid = keepsNaturalOrientation(params) ? built : orientForPrint(built);
  const name = `gridfinity-${params.width}x${params.depth}-lid`;

  // Same WASM-heap discipline as `generateLid`: the oriented solid is
  // caller-owned and must be released once the export buffer is built.
  try {
    if (format === 'step') {
      const blob = unwrapExportBlob(exportSTEP(solid), 'STEP');
      const data = await blob.arrayBuffer();
      return { data, fileName: `${name}.step` };
    }

    // Derived from the same (solid, tolerance) pair `exportSolidToStl` writes
    // from — brepjs caches `mesh()` by shape+tolerance, so diverging here would
    // silently misalign every per-triangle material index. Mirrors `exportBin`.
    const m = mesh(solid, { tolerance, angularTolerance });
    const faceGroups: FaceGroupData[] = m.faceGroups.map((g) => ({
      start: g.start,
      count: g.count,
      tag: g.origin !== 0 ? g.origin : FeatureTag.UNKNOWN,
    }));
    const data = await exportSolidToStl(solid, name, tolerance, angularTolerance);
    return { data, fileName: `${name}.stl`, faceGroups };
  } finally {
    solid.delete();
  }
}

/**
 * Export the standalone stack-grid baseplate. Returns null unless the lid opts
 * into `separateStackPlate` (via `buildStackPlate`) and `shouldGenerateLid`
 * passes.
 *
 * Unlike {@link exportLid}, the slab is NOT reoriented: it's built glue-face
 * down (flat bottom at Z=0, pockets up), which is already its ideal print
 * orientation. Same STL/STEP format convention as `exportLid`.
 */
export async function exportStackPlate(
  params: BinParams,
  format: ExportFormat,
  tolerance = 0.01,
  angularTolerance = 5
): Promise<LidExportResult | null> {
  if (!shouldGenerateLid(params)) return null;

  const solid = buildStackPlate(params);
  if (!solid) return null;
  const name = `gridfinity-${params.width}x${params.depth}-lid-baseplate`;

  try {
    if (format === 'step') {
      const blob = unwrapExportBlob(exportSTEP(solid), 'STEP');
      const data = await blob.arrayBuffer();
      return { data, fileName: `${name}.step` };
    }

    const data = await exportSolidToStl(solid, name, tolerance, angularTolerance);
    return { data, fileName: `${name}.stl` };
  } finally {
    solid.delete();
  }
}
