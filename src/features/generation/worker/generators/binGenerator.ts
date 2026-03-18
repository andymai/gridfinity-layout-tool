/**
 * Gridfinity bin generator orchestrator using brepjs (OpenCascade WASM).
 *
 * Composes the full generation pipeline from focused sub-modules:
 * - pipeline/ — composable stages: shell, features, boolean, translate, tessellate
 * - socketBuilder: per-cell segmented sockets (full 42mm + half 21mm cells)
 * - boxBuilder: rounded rect extruded + shelled (walls + floor) + stacking lip
 * - featureBuilder: dividers, inserts, cutouts, label tabs, scoop ramps
 * - shapeCache: memoization of expensive intermediate shapes
 *
 * Coordinate system:
 * - Z=0: bin floor level (where box meets socket)
 * - Socket: Z=-SOCKET_HEIGHT to Z=0
 * - Box body: Z=0 to Z=wallHeight
 * - Final mesh translated up by SOCKET_HEIGHT so Z=0 = absolute bottom
 */

import {
  box,
  unwrap,
  fuse,
  clone,
  translate,
  intersect,
  getBounds,
  mesh,
  meshEdges,
  exportSTL,
  exportSTEP,
} from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import type { MeshData, ExportFormat, FaceGroupData } from '../../bridge/types';
import { GRIDFINITY } from '@/shared/constants/bin';

import { SIZE, CLEARANCE, SOCKET_HEIGHT } from './generatorTypes';
import type { ProgressFn } from './generatorTypes';
import { toIndexedMeshData } from './meshUtils';
import { buildTopShape } from './boxBuilder';
import { getLastSolid } from './shapeCache';
import { applySplitConnectors, computeCutFaces } from './splitConnectorBuilder';
import type { BinGeometryContext } from './splitConnectorBuilder';

// Pipeline imports
import { createInitialContext, runPipeline } from './pipeline';
import type { PipelineStage } from './pipeline';
import { shellStage } from './pipeline/stages/shellStage';
import { featuresStage } from './pipeline/stages/featuresStage';
import { booleanStage } from './pipeline/stages/booleanStage';
import { translateStage } from './pipeline/stages/translateStage';
import { tessellateStage } from './pipeline/stages/tessellateStage';
export type { ProgressFn } from './generatorTypes';

/** Export result with binary data and suggested file name. */
export interface ExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
  readonly faceGroups?: readonly FaceGroupData[];
}

/** Result of a split export: array of piece buffers with grid labels */
export interface SplitExportResult {
  readonly pieces: Array<{
    readonly data: ArrayBuffer;
    readonly label: string;
    readonly col: number;
    readonly row: number;
  }>;
}

/** Get the last generated solid for export operations. */
export { getLastSolid };
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
/** Default generation pipeline: shell → features → boolean → translate → tessellate */
const DEFAULT_PIPELINE: readonly PipelineStage[] = [
  shellStage,
  featuresStage,
  booleanStage,
  translateStage,
  tessellateStage,
];
/**
 * Generate a complete Gridfinity bin from parameters.
 *
 * Runs the composable pipeline: shell assembly, feature building, boolean
 * operations, Z-translation, and tessellation. Each stage is independently
 * testable and cacheable.
 *
 * @param params Bin configuration parameters
 * @param onProgress Optional progress callback
 * @param forExport If true, generates full-fidelity geometry for 3D printing.
 *                  Preview mode uses simplified geometry for faster rendering.
 */
export function generateBin(
  params: BinParams,
  onProgress?: ProgressFn,
  forExport = false,
  signal?: AbortSignal
): MeshData {
  const ctx = createInitialContext(params, onProgress, forExport, signal);
  const result = runPipeline(DEFAULT_PIPELINE, ctx);

  if (!result.mesh) {
    throw new Error('Pipeline did not produce mesh output');
  }

  return result.mesh;
}
/** Height of the cutting box used for boolean intersection (much taller than any bin) */
const CUTTING_BOX_HEIGHT = 500;

/**
 * Overlap (mm) between lip and body wall when splitting bins with stacking lips.
 *
 * The lip solid is shifted down by this amount so it penetrates into the body
 * wall, giving the boolean fuse a volumetric overlap region. Without this, lip
 * and body share only edges at the wall top and the fuse produces degenerate
 * faces at the lip-wall junction (visible as gaps/artifacts in the preview).
 */
const LIP_FUSE_OVERLAP = 0.05;

/** Metadata for a single split piece within the grid */
interface SplitPieceInfo {
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
 * Split the bin solid into pieces via boolean intersection.
 *
 * Shared by exportSplitBin (STL output) and generateSplitPreview (mesh output).
 * Ensures the solid exists, computes cutting regions, applies connectors, and
 * returns each piece solid with positioning metadata.
 *
 * When the bin has a stacking lip, the body and lip are split separately and
 * then fused per-piece. This avoids an OCCT bug where intersecting the fused
 * bin+lip solid crashes at certain wall thicknesses (e.g. 1.6mm) due to
 * complex BREP topology at the lip-wall junction.
 */
function splitSolidIntoPieces(
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  splitConnectorConfig?: SplitConnectorConfig
): SplitPieceInfo[] {
  const hasLip = params.base.stackingLip;

  // Generate body solid. When the bin has a stacking lip, generate WITHOUT
  // the lip to avoid OCCT boolean intersection crashes. The lip is split
  // separately and fused onto each piece below.
  const bodyParams = hasLip ? { ...params, base: { ...params.base, stackingLip: false } } : params;
  generateBin(bodyParams, undefined, true);

  const bodySolid = getLastSolid();
  if (!bodySolid) {
    throw new Error('Failed to generate solid for splitting');
  }

  const outerW = params.width * SIZE - CLEARANCE;
  const outerD = params.depth * SIZE - CLEARANCE;

  const connectorConfig = splitConnectorConfig ?? params.splitConnectors;

  // Bin geometry context for connector placement
  const isFlat = params.base.style === 'flat';
  const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;
  const wallHeight = isFlat ? totalHeight : totalHeight - SOCKET_HEIGHT;
  const floorZ = isFlat ? 0 : SOCKET_HEIGHT;
  const wallTopZ = floorZ + wallHeight;

  // Build lip solid separately if needed. The lip is positioned at
  // wallTopZ (= totalHeight for both flat and socket bases after the
  // socket Z-offset applied in generateBin), shifted down by
  // LIP_FUSE_OVERLAP to ensure a volumetric overlap for clean fusing.
  let lipSolid: Shape3D | undefined;
  if (hasLip) {
    lipSolid = translate(buildTopShape(params.width, params.depth, true), [
      0,
      0,
      wallTopZ - LIP_FUSE_OVERLAP,
    ]);
  }

  // Boundary arrays: [left edge, ...cut planes, right edge]
  const xBounds = [-outerW / 2, ...cutPlanesX, outerW / 2];
  const yBounds = [-outerD / 2, ...cutPlanesY, outerD / 2];

  // Outer edges of the cutting box are expanded by this margin to avoid
  // coplanar faces with bin geometry, which cause OCCT booleans to
  // silently drop outer walls.
  const EDGE_MARGIN = 1;

  // Interior cut faces also need a small offset to avoid coplanarity with
  // socket cell boundaries (e.g. a 10-wide bin split at cell 5 puts the
  // cut plane exactly on the cell wall at x=0). 10μm is invisible in FDM
  // print but breaks the coplanarity that causes OCCT to drop geometry.
  const INTERIOR_MARGIN = 0.01;

  const pieces: SplitPieceInfo[] = [];

  for (let col = 0; col < xBounds.length - 1; col++) {
    for (let row = 0; row < yBounds.length - 1; row++) {
      const xMin = xBounds[col];
      const xMax = xBounds[col + 1];
      const yMin = yBounds[row];
      const yMax = yBounds[row + 1];

      const pieceW = xMax - xMin;
      const pieceD = yMax - yMin;
      const centerX = (xMin + xMax) / 2;
      const centerY = (yMin + yMax) / 2;
      const colLabel = String.fromCharCode(65 + col); // A, B, C…

      // Expand cutting box at outer bin edges to avoid coplanar booleans;
      // interior faces get a smaller margin to break socket wall coplanarity.
      const marginL = col === 0 ? EDGE_MARGIN : INTERIOR_MARGIN;
      const marginR = col === xBounds.length - 2 ? EDGE_MARGIN : INTERIOR_MARGIN;
      const marginB = row === 0 ? EDGE_MARGIN : INTERIOR_MARGIN;
      const marginT = row === yBounds.length - 2 ? EDGE_MARGIN : INTERIOR_MARGIN;
      const boxW = pieceW + marginL + marginR;
      const boxD = pieceD + marginB + marginT;
      const boxCenterX = centerX + (marginR - marginL) / 2;
      const boxCenterY = centerY + (marginT - marginB) / 2;

      const cuttingBox = box(boxW, boxD, CUTTING_BOX_HEIGHT, {
        at: [boxCenterX, boxCenterY, 0],
      });

      // Split body with cutting box
      let piece = unwrap(intersect(clone(bodySolid), cuttingBox));

      // Validate that the boolean intersection preserved the full geometry.
      // If OCCT silently dropped walls/lip due to coplanarity, the Z extent
      // will be far shorter than expected (e.g. ~5mm socket-only vs ~25mm).
      const pieceBounds = getBounds(piece);
      const actualZ = pieceBounds.zMax - pieceBounds.zMin;
      if (actualZ < totalHeight * 0.8) {
        throw new Error(
          `Split piece ${colLabel}${row + 1} lost geometry: ` +
            `expected body Z≈${totalHeight.toFixed(1)}mm (lip fused separately), got ${actualZ.toFixed(1)}mm. ` +
            `This is likely caused by a coplanar cut plane — please report this bug.`
        );
      }

      // Split and fuse lip piece using a clone of the same cutting box
      if (lipSolid) {
        try {
          const lipPiece = unwrap(intersect(clone(lipSolid), clone(cuttingBox)));
          piece = unwrap(fuse(piece, lipPiece));
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') throw e;
          // Lip fuse failed — export piece without lip (non-critical degradation)
        }
      }

      if (connectorConfig?.enabled) {
        const cutFaces = computeCutFaces(
          col,
          row,
          cutPlanesX,
          cutPlanesY,
          outerW,
          outerD,
          pieceW,
          pieceD,
          centerX,
          centerY
        );
        const geometryContext: BinGeometryContext = {
          floorZ,
          wallTopZ,
          wallThickness: params.wallThickness,
          floorThickness: params.wallThickness,
        };
        piece = applySplitConnectors(piece, cutFaces, geometryContext, connectorConfig);
      }

      pieces.push({
        solid: piece,
        label: `${colLabel}${row + 1}`,
        col: col + 1,
        row: row + 1,
        widthMm: pieceW,
        depthMm: pieceD,
        xMinFromOrigin: xMin + outerW / 2,
        yMinFromOrigin: yMin + outerD / 2,
      });
    }
  }

  return pieces;
}
/**
 * Export the cached (or regenerated) bin solid, split into pieces via boolean cuts.
 *
 * Each piece is independently tessellated to STL.
 */
export async function exportSplitBin(
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  tolerance = 0.01,
  angularTolerance = 5,
  splitConnectorConfig?: SplitConnectorConfig
): Promise<SplitExportResult> {
  const splitPieces = splitSolidIntoPieces(params, cutPlanesX, cutPlanesY, splitConnectorConfig);

  const pieces: SplitExportResult['pieces'] = [];

  for (const { solid: pieceSolid, label, col, row } of splitPieces) {
    const blob = unwrap(exportSTL(pieceSolid, { tolerance, angularTolerance, binary: true }));
    const data = await blob.arrayBuffer();
    pieces.push({ data, label, col, row });
  }

  return { pieces };
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

/** Preview tessellation tolerance: moderate quality for responsive interaction */
const PREVIEW_TOLERANCE = 0.15;
const PREVIEW_ANGULAR_TOLERANCE = 15;

/** Tessellate a split piece into preview mesh data */
function tessellatePiece(
  piece: SplitPieceInfo,
  outerW: number,
  outerD: number,
  gridUnitMm: number
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
  const centeredPiece = translate(pieceSolid, [-pieceCenterX, -pieceCenterY, 0]);

  const shapeMesh = mesh(centeredPiece, {
    tolerance: PREVIEW_TOLERANCE,
    angularTolerance: PREVIEW_ANGULAR_TOLERANCE,
  });
  const edgeMesh = meshEdges(centeredPiece, {
    tolerance: PREVIEW_TOLERANCE,
    angularTolerance: PREVIEW_ANGULAR_TOLERANCE,
  });
  const meshData = toIndexedMeshData(shapeMesh, false, new Float32Array(edgeMesh.lines));

  return {
    vertices: meshData.vertices,
    normals: meshData.normals,
    indices: meshData.indices,
    edgeVertices: meshData.edgeVertices,
    label,
    col,
    row,
    widthUnits: widthMm / gridUnitMm,
    depthUnits: depthMm / gridUnitMm,
    offsetX: xMinFromOrigin / gridUnitMm,
    offsetY: yMinFromOrigin / gridUnitMm,
  };
}

/**
 * Generate split bin piece meshes for 3D preview rendering.
 *
 * Uses the same splitting logic as exportSplitBin but produces mesh data
 * (vertices/normals/indices) instead of STL buffers, so pieces can be
 * rendered as individual Three.js meshes.
 */
export function generateSplitPreview(
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  splitConnectorConfig?: SplitConnectorConfig
): SplitPreviewResult {
  const splitPieces = splitSolidIntoPieces(params, cutPlanesX, cutPlanesY, splitConnectorConfig);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive fallback for backwards compatibility
  const gridUnitMm = params.gridUnitMm ?? SIZE;
  const outerW = params.width * gridUnitMm - CLEARANCE;
  const outerD = params.depth * gridUnitMm - CLEARANCE;

  return { pieces: splitPieces.map((piece) => tessellatePiece(piece, outerW, outerD, gridUnitMm)) };
}
/**
 * Generate split preview meshes for a subset of pieces.
 *
 * Each pool worker calls this with its assigned pieceIndices. The full solid
 * is regenerated per worker (each has independent WASM), but only the
 * assigned pieces are tessellated — the expensive per-piece work.
 */
export function generateSplitPreviewRange(
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  pieceIndices: readonly number[],
  splitConnectorConfig?: SplitConnectorConfig
): SplitPreviewResult {
  const splitPieces = splitSolidIntoPieces(params, cutPlanesX, cutPlanesY, splitConnectorConfig);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive fallback for backwards compatibility
  const gridUnitMm = params.gridUnitMm ?? SIZE;
  const outerW = params.width * gridUnitMm - CLEARANCE;
  const outerD = params.depth * gridUnitMm - CLEARANCE;

  const pieces: SplitPreviewResult['pieces'] = [];
  for (const idx of pieceIndices) {
    if (idx < 0 || idx >= splitPieces.length) {
      throw new Error(`Piece index ${idx} out of range [0, ${splitPieces.length})`);
    }
    pieces.push(tessellatePiece(splitPieces[idx], outerW, outerD, gridUnitMm));
  }

  return { pieces };
}

/**
 * Export split bin pieces for a subset of piece indices.
 *
 * Same as exportSplitBin but only processes the assigned pieces,
 * allowing parallel export across multiple workers.
 */
export async function exportSplitBinRange(
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  pieceIndices: readonly number[],
  tolerance = 0.01,
  angularTolerance = 5,
  splitConnectorConfig?: SplitConnectorConfig
): Promise<SplitExportResult> {
  const splitPieces = splitSolidIntoPieces(params, cutPlanesX, cutPlanesY, splitConnectorConfig);

  const pieces: SplitExportResult['pieces'] = [];

  for (const idx of pieceIndices) {
    if (idx < 0 || idx >= splitPieces.length) {
      throw new Error(`Piece index ${idx} out of range [0, ${splitPieces.length})`);
    }

    const { solid: pieceSolid, label, col, row } = splitPieces[idx];
    const blob = unwrap(exportSTL(pieceSolid, { tolerance, angularTolerance, binary: true }));
    const data = await blob.arrayBuffer();
    pieces.push({ data, label, col, row });
  }

  return { pieces };
}
