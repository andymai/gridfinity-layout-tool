/**
 * Split bin operations — cutting, tessellating, and exporting bin pieces.
 *
 * Handles splitting a full bin solid into grid-aligned pieces via boolean
 * intersection, with optional stacking lip separation and split connectors.
 */

import { translate, mesh, meshEdges, exportSTEP, getKernelCapabilities } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import type { ExportFormat } from '../../bridge/types';

import { buildSTLBufferFromIndexed } from '@/features/generation/export/stlExporter';
import { type GridPitch } from './gridPitch';
import { toIndexedMeshData } from './utils/mesh';
import { creaseEdges } from './utils';
import { EDGE_ANGULAR_TOLERANCE_RAD } from '@/shared/constants/tessellation';
import { hasMeshImprints, imprintPieceArrays } from './meshImprint';
import { unwrapExportBlob } from './utils/exportUnwrap';
import { deriveDimensions } from './pipeline/context';

/** Result of a split export: array of piece buffers with grid labels */
export interface SplitExportResult {
  readonly pieces: Array<{
    readonly data: ArrayBuffer;
    readonly label: string;
    readonly col: number;
    readonly row: number;
  }>;
}

/** Result of split preview generation: mesh data per piece for Three.js */
export interface SplitPreviewResult {
  readonly pieces: Array<{
    readonly vertices: Float32Array;
    readonly normals: Float32Array;
    readonly indices: Uint32Array;
    readonly edgeVertices: Float32Array;
    readonly label: string;
    readonly col: number;
    readonly row: number;
    readonly widthUnits: number;
    readonly depthUnits: number;
    readonly offsetX: number;
    readonly offsetY: number;
  }>;
}

/** Preview tessellation tolerance: tightened for smooth normals on curved surfaces */
const PREVIEW_TOLERANCE = 0.1;

const PREVIEW_ANGULAR_TOLERANCE = 10;

/** Metadata for a single split piece within the grid */
export interface SplitPieceInfo {
  readonly solid: Shape3D;
  readonly label: string;
  readonly col: number;
  readonly row: number;
  /** Piece width in mm */
  readonly widthMm: number;
  /** Piece depth in mm */
  readonly depthMm: number;
  /** X offset of piece's left edge from bin origin, in mm */
  readonly xMinFromOrigin: number;
  /** Y offset of piece's bottom edge from bin origin, in mm */
  readonly yMinFromOrigin: number;
}

/**
 * Tessellate a split piece and serialize it to a binary STL ArrayBuffer.
 *
 * Path: `brepjs.mesh()` → `buildSTLBufferFromIndexed()`.
 *
 * We deliberately bypass brepjs's `exportSTL()` (which calls OCCT's
 * `StlAPI.Write`). For bins with a scoop ramp and walls tall enough that
 * the scoop radius is sizeable (e.g. height=9 → radius=29mm), the boolean
 * cut leaves a BREP topology that triangulates correctly via `mesh()` but
 * trips a silent failure in `StlAPI.Write` — exportSTL returns
 * `STL_EXPORT_FAILED` regardless of tolerance.
 *
 * Writing STL from the meshed triangle buffer ourselves removes the
 * dependency on OCCT's STL writer; `buildSTLBufferFromIndexed` runs on
 * the exact same triangles the preview path already renders cleanly.
 */
function tessellateAndExportPiece(
  piece: SplitPieceInfo,
  params: BinParams,
  outerW: number,
  outerD: number,
  tolerance: number,
  angularTolerance: number
): ArrayBuffer {
  const { solid: pieceSolid } = piece;
  try {
    const m = mesh(pieceSolid, { tolerance, angularTolerance, cache: false });
    let vertices = m.vertices instanceof Float32Array ? m.vertices : new Float32Array(m.vertices);
    let normals = m.normals instanceof Float32Array ? m.normals : new Float32Array(m.normals);
    let indices = m.triangles instanceof Uint32Array ? m.triangles : new Uint32Array(m.triangles);
    // Mesh imprint pockets subtract post-tessellation (they never exist on
    // the BREP solid). Export pieces stay in the bin frame, so tools place
    // directly; a pocket straddling a seam cuts every piece it touches.
    const imprinted = imprintPieceArrays(
      vertices,
      indices,
      params,
      deriveDimensions(params, true),
      {
        minX: piece.xMinFromOrigin - outerW / 2,
        minY: piece.yMinFromOrigin - outerD / 2,
        maxX: piece.xMinFromOrigin - outerW / 2 + piece.widthMm,
        maxY: piece.yMinFromOrigin - outerD / 2 + piece.depthMm,
      }
    );
    if (imprinted) {
      vertices = imprinted.positions;
      normals = imprinted.normals;
      indices = imprinted.indices;
    }
    return buildSTLBufferFromIndexed(vertices, normals, indices, `gridfinity-piece-${piece.label}`);
  } finally {
    pieceSolid.delete();
  }
}

/**
 * Write one split piece as STEP.
 *
 * STEP carries the exact BREP solid, so there is no tessellation and no mesh
 * imprint pass — the pocket subtraction only exists post-tessellation, which
 * is why {@link exportSplitBin} refuses STEP for an imprinted design instead
 * of silently shipping pieces without pockets.
 *
 * The piece keeps the bin's own coordinate frame, matching the STL path, so an
 * importer that opens every piece at once sees them already aligned.
 */
async function exportPieceAsStep(piece: SplitPieceInfo): Promise<ArrayBuffer> {
  const { solid: pieceSolid } = piece;
  try {
    const blob = unwrapExportBlob(exportSTEP(pieceSolid), 'STEP');
    return await blob.arrayBuffer();
  } finally {
    pieceSolid.delete();
  }
}

/**
 * Write one split piece in the requested format. Both branches dispose the
 * piece solid — callers only clean up pieces they never handed over.
 */
export function exportPiece(
  piece: SplitPieceInfo,
  params: BinParams,
  outerW: number,
  outerD: number,
  tolerance: number,
  angularTolerance: number,
  format: ExportFormat
): Promise<ArrayBuffer> {
  if (format === 'step') return exportPieceAsStep(piece);
  return Promise.resolve(
    tessellateAndExportPiece(piece, params, outerW, outerD, tolerance, angularTolerance)
  );
}

/**
 * STEP describes a solid, and a mesh imprint is carved out of the tessellated
 * mesh after the solid exists — so an imprinted design has no solid that
 * describes it. Mirrors `exportBin`'s guard: refuse rather than ship pieces
 * missing their pockets.
 */
export function assertStepExportable(params: BinParams, format: ExportFormat): void {
  if (format === 'step' && hasMeshImprints(params)) {
    throw new Error(
      'STEP export is not available for designs with mesh imprint cutouts — use STL or 3MF'
    );
  }
}

/** Tessellate a split piece into preview mesh data */
export function tessellatePiece(
  piece: SplitPieceInfo,
  params: BinParams,
  outerW: number,
  outerD: number,
  pitch: GridPitch
): SplitPreviewResult['pieces'][number] {
  const {
    solid: pieceSolid,
    label,
    col,
    row,
    widthMm,
    depthMm,
    xMinFromOrigin,
    yMinFromOrigin,
  } = piece;

  const pieceCenterX = xMinFromOrigin - outerW / 2 + widthMm / 2;
  const pieceCenterY = yMinFromOrigin - outerD / 2 + depthMm / 2;

  // translate() returns a fresh shape; the original pieceSolid is never used
  // again after tessellation, so dispose it here. Without this the per-piece
  // boolean solids leak WASM memory across repeated preview generations.
  let meshData;
  try {
    const centeredPiece = translate(pieceSolid, [-pieceCenterX, -pieceCenterY, 0]);
    // Dispose centeredPiece in a finally so a throw in mesh()/meshEdges()/
    // creaseEdges() doesn't leak the translated WASM handle.
    try {
      const shapeMesh = mesh(centeredPiece, {
        tolerance: PREVIEW_TOLERANCE,
        angularTolerance: PREVIEW_ANGULAR_TOLERANCE,
      });
      // Build-time kernels (manifold draft) have no B-rep topology, so
      // `meshEdges()` returns the full triangle wireframe — every facet line,
      // not feature edges. That paints the freshly-cut faces and curved socket
      // walls as wireframe noise. Recover clean feature edges from the mesh via
      // dihedral crease detection, mirroring `tessellateStage` for whole bins.
      const buildTime = getKernelCapabilities().tessellationModel === 'build-time';
      const edgeLines = buildTime
        ? creaseEdges(shapeMesh)
        : meshEdges(centeredPiece, {
            tolerance: PREVIEW_TOLERANCE,
            angularTolerance: EDGE_ANGULAR_TOLERANCE_RAD,
          }).lines;
      meshData = toIndexedMeshData(shapeMesh, edgeLines);
    } finally {
      centeredPiece.delete();
    }
  } finally {
    pieceSolid.delete();
  }

  // Mesh imprint pockets subtract post-tessellation. The preview mesh was
  // recentered on the piece, so tools shift into the same local frame and the
  // clip bounds are the piece's local bbox.
  const imprinted = imprintPieceArrays(
    meshData.vertices,
    meshData.indices,
    params,
    deriveDimensions(params, false),
    { minX: -widthMm / 2, minY: -depthMm / 2, maxX: widthMm / 2, maxY: depthMm / 2 },
    { x: pieceCenterX, y: pieceCenterY }
  );
  if (imprinted) {
    meshData = {
      ...meshData,
      vertices: imprinted.positions,
      normals: imprinted.normals,
      indices: imprinted.indices,
      edgeVertices: creaseEdges({ vertices: imprinted.positions, triangles: imprinted.indices }),
    };
  }

  return {
    vertices: meshData.vertices,
    normals: meshData.normals,
    indices: meshData.indices,
    edgeVertices: meshData.edgeVertices,
    label,
    col,
    row,
    widthUnits: widthMm / pitch.x,
    depthUnits: depthMm / pitch.y,
    offsetX: xMinFromOrigin / pitch.x,
    offsetY: yMinFromOrigin / pitch.y,
  };
}
