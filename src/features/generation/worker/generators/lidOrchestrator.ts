/**
 * Click-lock lid generation entry point.
 *
 * Builds the lid solid via `buildLid` and tessellates it into a MeshData
 * suitable for rendering and export. Returns null when the lid is not
 * enabled or the bin has no stacking lip (the lid mates with the lip,
 * so it's pointless without one).
 */

import { mesh, meshEdges, rotate, unwrap, exportSTL, exportSTEP } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData, ExportFormat } from '../../bridge/types';
import type { ProgressFn } from './generatorTypes';
import { buildLid } from './lidBuilder';
import { toIndexedMeshData } from './utils/mesh';
import { computeTessellationTolerances } from './utils/tolerances';
import { checkCancelled } from './meshUtils';
import { SIZE } from './generatorConstants';

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
 * Caller owns the returned solid; this function deletes the input.
 */
function orientForPrint(lidSolid: Shape3D): Shape3D {
  const oriented = rotate(lidSolid, 180, { axis: [1, 0, 0] });
  lidSolid.delete();
  return oriented;
}

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

  // `buildLid` returns a caller-owned WASM solid; once we've tessellated
  // it into JS-side mesh data, the OCCT shape is no longer needed and
  // must be `.delete()`'d or it leaks into the WASM heap (every param
  // change runs `generateLid`, so this would accumulate quickly). The
  // try/finally pattern mirrors `baseplateGenerator`'s lifecycle.
  try {
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
  } finally {
    solid.delete();
  }
}

/** Export result for the lid (binary STL or STEP buffer). */
export interface LidExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
}

/**
 * Export the lid in the requested format. Builds a fresh export-quality
 * solid each time. Returns null when the lid is not enabled.
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
  if (!params.lid.enabled) return null;
  if (!params.base.stackingLip) return null;

  const solid = orientForPrint(buildLid(params));
  const name = `gridfinity-${params.width}x${params.depth}-lid`;

  // Same WASM-heap discipline as `generateLid`: the oriented solid is
  // caller-owned and must be released once the export buffer is built.
  try {
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
  } finally {
    solid.delete();
  }
}
