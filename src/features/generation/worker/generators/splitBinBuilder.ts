/**
 * Split bin operations — cutting, tessellating, and exporting bin pieces.
 *
 * Handles splitting a full bin solid into grid-aligned pieces via boolean
 * intersection, with optional stacking lip separation and split connectors.
 */

import {
  box,
  unwrap,
  fuse,
  cut,
  clone,
  translate,
  intersect,
  getBounds,
  mesh,
  meshEdges,
  exportSTL,
} from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';

import { SIZE, CLEARANCE, SOCKET_HEIGHT } from './generatorTypes';
import { unwrapExportBlob } from './utils/exportUnwrap';
import { LIP_HEIGHT, LIP_TAPER_WIDTH } from './generatorConstants';
import { toIndexedMeshData } from './utils/mesh';
import { buildTopShape } from './boxBuilder';
import { generateBin } from './binOrchestrator';
import { getLastSolid, setLastSolid } from './shapeCache';
import { applySplitConnectors, computeCutFaces } from './splitConnectorBuilder';
import type { BinGeometryContext } from './splitConnectorBuilder';
import { buildLipSlotCuts } from './slotBuilder';
import { isAbortError } from './utils/abort';

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

/** Preview tessellation tolerance: tightened for smooth normals on curved surfaces */
const PREVIEW_TOLERANCE = 0.1;
const PREVIEW_ANGULAR_TOLERANCE = 10;

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
 * Tolerance for "cut plane is on a cell boundary" detection (mm). The bin's
 * socket cells share walls at every gridUnit step, so a cut plane within
 * this distance of one is treated as coincident.
 */
const CELL_BOUNDARY_TOLERANCE = 0.001;

/**
 * Amount to nudge a cut plane off a coincident cell boundary (mm).
 * 0.1mm is below the visible-seam threshold for FDM prints and is well
 * above OCCT's coplanar-face tolerance, so the boolean cut sees two
 * cleanly distinct faces rather than a near-coincident pair that
 * triggers wall-dropping (issue #1676).
 */
const CELL_BOUNDARY_NUDGE = 0.1;

/**
 * Shift any cut plane that lands on a socket-cell boundary by a tiny
 * amount so it no longer coincides with the bin's internal wall plane.
 *
 * Cell boundaries (in bin-centered coords) sit at `(i - cells/2) * gridUnit`
 * for `i` in `0..cells`. For an even-numbered cell count (e.g. depth=10),
 * the natural even-split cut plane lands at exactly y=0, which is one of
 * those boundaries.
 *
 * Pieces still meet flush — they both use the shifted plane — so the
 * nudge just translates the seam, it doesn't create overlap.
 */
export function shiftCutPlanesOffCellBoundaries(
  cutPlanes: readonly number[],
  cells: number,
  gridUnitMm: number
): number[] {
  if (!Number.isFinite(gridUnitMm) || gridUnitMm <= 0 || cells <= 0) {
    return [...cutPlanes];
  }

  const halfCells = cells / 2;
  return cutPlanes.map((plane) => {
    // Convert plane y to a fractional cell index. Integer values are on a
    // boundary; the i=0 and i=cells boundaries lie on the bin's outer wall
    // (covered by EDGE_MARGIN), so only INTERIOR integers matter.
    const cellIndex = plane / gridUnitMm + halfCells;
    const nearest = Math.round(cellIndex);
    if (nearest <= 0 || nearest >= cells) return plane;
    const distanceMm = Math.abs(cellIndex - nearest) * gridUnitMm;
    if (distanceMm < CELL_BOUNDARY_TOLERANCE) {
      return plane + CELL_BOUNDARY_NUDGE;
    }
    return plane;
  });
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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive fallback for backwards compatibility
  const gridUnitMm = params.gridUnitMm ?? SIZE;
  const outerW = params.width * gridUnitMm - CLEARANCE;
  const outerD = params.depth * gridUnitMm - CLEARANCE;

  const connectorConfig = splitConnectorConfig ?? params.splitConnectors;

  // Bin geometry context for connector placement
  const isFlat = params.base.style === 'flat';
  const totalHeight = params.height * params.heightUnitMm;
  const wallHeight = isFlat ? totalHeight : totalHeight - SOCKET_HEIGHT;
  const floorZ = isFlat ? 0 : SOCKET_HEIGHT;
  const wallTopZ = floorZ + wallHeight;

  // Build lip solid separately if needed. The lip is positioned at
  // wallTopZ (= totalHeight for both flat and socket bases after the
  // socket Z-offset applied in generateBin), shifted down by
  // LIP_FUSE_OVERLAP to ensure a volumetric overlap for clean fusing.
  let lipSolid: Shape3D | undefined;
  if (hasLip) {
    const lipBase = buildTopShape(params.width, params.depth, true, params.gridUnitMm);
    lipSolid = translate(lipBase, [0, 0, wallTopZ - LIP_FUSE_OVERLAP]);
    lipBase.delete();

    // For slotted bins, cut divider notches through the lip so removable
    // dividers can slide in from the top. The wall slot cuts already live in
    // the body solid (applied via the normal pipeline on bodyParams), but the
    // lip is built fresh here and would otherwise block the dividers.
    //
    // Body wall slots were positioned with edgeInset=0 (bodyParams strips
    // stackingLip, so dim.hasLip=false in the pipeline). Pass the same inset
    // here to keep the lip cuts aligned with the body's wall slots.
    if (params.style === 'slotted') {
      const innerW = outerW - 2 * params.wallThickness;
      const innerD = outerD - 2 * params.wallThickness;
      const lipInfo = {
        wallHeight: wallTopZ,
        lipHeight: LIP_HEIGHT,
        lipTaperWidth: LIP_TAPER_WIDTH,
      };
      const lipCuts = buildLipSlotCuts(params, innerW, innerD, lipInfo, 0);
      if (lipCuts) {
        try {
          const newLip = unwrap(cut(lipSolid as ValidSolid, lipCuts as ValidSolid));
          lipSolid.delete();
          lipSolid = newLip;
        } finally {
          lipCuts.delete();
        }
      }
    }
  }

  // When a cut plane lands exactly on a socket-cell boundary (e.g. depth=10
  // split into 5+5 puts the cut at y=0, which is the shared wall between
  // adjacent socket cells), the per-piece 0.01mm cutting-box overlap isn't
  // enough — OCCT still treats some interior faces as coplanar and drops
  // walls (issue #1676 reported A2 lost ~22mm of body Z). Shifting the cut
  // plane itself by 0.1mm fully resolves the coplanarity at both faces and
  // keeps the pieces flush (no overlap region, just a 0.1mm offset that's
  // invisible to FDM print and barely felt at the join).
  const adjustedCutPlanesX = shiftCutPlanesOffCellBoundaries(cutPlanesX, params.width, gridUnitMm);
  const adjustedCutPlanesY = shiftCutPlanesOffCellBoundaries(cutPlanesY, params.depth, gridUnitMm);

  // Boundary arrays: [left edge, ...cut planes, right edge]
  const xBounds = [-outerW / 2, ...adjustedCutPlanesX, outerW / 2];
  const yBounds = [-outerD / 2, ...adjustedCutPlanesY, outerD / 2];

  // Outer edges of the cutting box are expanded by this margin to avoid
  // coplanar faces with bin geometry, which cause OCCT booleans to
  // silently drop outer walls.
  const EDGE_MARGIN = 1;

  // Interior cut faces still get a small overlap to defeat coplanarity
  // tolerance at the cut. With shiftCutPlanesOffCellBoundaries() above,
  // the cut plane itself is already off any cell wall — this offset is the
  // belt to the suspenders of the cell-boundary shift.
  const INTERIOR_MARGIN = 0.01;

  const pieces: SplitPieceInfo[] = [];

  try {
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
        const colLabel = String.fromCharCode(65 + col); // A, B, C...

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

        // Split body with cutting box — intersect creates new shape, inputs persist
        const bodyClone = unwrap(clone(bodySolid));
        let piece = unwrap(intersect(bodyClone, cuttingBox));
        bodyClone.delete();

        // Validate that the boolean intersection preserved the full geometry.
        // If OCCT silently dropped walls/lip due to coplanarity, the Z extent
        // will be far shorter than expected (e.g. ~5mm socket-only vs ~25mm).
        const pieceBounds = getBounds(piece);
        const actualZ = pieceBounds.zMax - pieceBounds.zMin;
        if (actualZ < totalHeight * 0.8) {
          piece.delete();
          cuttingBox.delete();
          throw new Error(
            `Split piece ${colLabel}${row + 1} lost geometry: ` +
              `expected body Z≈${totalHeight.toFixed(1)}mm (lip fused separately), got ${actualZ.toFixed(1)}mm. ` +
              `This is likely caused by a coplanar cut plane — please report this bug.`
          );
        }

        // Split and fuse lip piece using a clone of the same cutting box
        if (lipSolid) {
          try {
            const lipClone = unwrap(clone(lipSolid));
            const boxClone = unwrap(clone(cuttingBox));
            const lipPiece = unwrap(intersect(lipClone, boxClone));
            lipClone.delete();
            boxClone.delete();
            const oldPiece = piece;
            piece = unwrap(fuse(oldPiece, lipPiece));
            oldPiece.delete();
            lipPiece.delete();
          } catch (e) {
            if (isAbortError(e)) throw e;
            // Lip fuse failed — export piece without lip (non-critical degradation)
          }
        }

        cuttingBox.delete();

        if (connectorConfig?.enabled) {
          const cutFaces = computeCutFaces(
            col,
            row,
            adjustedCutPlanesX,
            adjustedCutPlanesY,
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
  } finally {
    if (lipSolid) lipSolid.delete();

    // The solid cached in lastSolid was generated for bodyParams (which strips
    // the stacking lip to avoid OCCT boolean crashes). Mark it as NOT
    // export-quality so that a subsequent exportBin(params) call regenerates
    // with the caller's full params instead of reusing the body-only solid.
    // Without this, exportBin would export a bin missing its stacking lip, and
    // the mixed tessellation left by the boolean operations can cause
    // StlAPI.Write to fail with "Failed to write STL file".
    setLastSolid(getLastSolid(), false);
  }

  return pieces;
}

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
    angularTolerance: PREVIEW_ANGULAR_TOLERANCE * 0.5,
  });
  centeredPiece.delete();
  const meshData = toIndexedMeshData(shapeMesh, edgeMesh.lines);

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
    // Force complete tessellation before export. Boolean intersection reuses
    // some original faces (with existing triangulation) but creates new faces
    // at cut planes (without triangulation). brepjs exportSTL skips meshing
    // when hasTriangulation() finds ANY tessellated face, leaving new faces
    // un-tessellated. Calling mesh() first runs BRepMesh_IncrementalMesh which
    // fills in the missing triangulation on cut-plane faces.
    mesh(pieceSolid, { tolerance, angularTolerance, cache: false });
    const blob = unwrapExportBlob(
      exportSTL(pieceSolid, { tolerance, angularTolerance, binary: true }),
      'STL'
    );
    const data = await blob.arrayBuffer();
    pieceSolid.delete();
    pieces.push({ data, label, col, row });
  }

  return { pieces };
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
    // Force complete tessellation (see exportSplitBin comment for rationale)
    mesh(pieceSolid, { tolerance, angularTolerance, cache: false });
    const blob = unwrapExportBlob(
      exportSTL(pieceSolid, { tolerance, angularTolerance, binary: true }),
      'STL'
    );
    const data = await blob.arrayBuffer();
    pieceSolid.delete();
    pieces.push({ data, label, col, row });
  }

  // Dispose unused split pieces (not in pieceIndices)
  for (let i = 0; i < splitPieces.length; i++) {
    if (!pieceIndices.includes(i)) {
      splitPieces[i].solid.delete();
    }
  }

  return { pieces };
}
