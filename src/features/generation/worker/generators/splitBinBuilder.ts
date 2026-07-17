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
  getKernelCapabilities,
} from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';

import { CLEARANCE, SOCKET_HEIGHT } from './generatorTypes';
import { buildSTLBufferFromIndexed } from '@/features/generation/export/stlExporter';
import { LIP_HEIGHT, LIP_TAPER_WIDTH } from './generatorConstants';
import { pitchFromParams, type GridPitch } from './gridPitch';
import { toIndexedMeshData } from './utils/mesh';
import { creaseEdges } from './utils';
import { EDGE_ANGULAR_TOLERANCE_RAD } from '@/shared/constants/tessellation';
import { buildTopShape } from './boxBuilder';
import { generateBin } from './binOrchestrator';
import { getLastSolid, setLastSolid } from './shapeCache';
import { applySplitConnectors, computeCutFaces } from './splitConnectorBuilder';
import type { BinGeometryContext } from './splitConnectorBuilder';
import { buildLipSlotCuts } from './slotBuilder';
import { buildWallCutoutCuts } from './wallCutoutBuilder';
import { isAbortError } from './utils/abort';
import { resolveOverhang } from './overhang';
import { isPartialMask } from '@/shared/utils/cellMask';
import { imprintPieceArrays } from './meshImprint';
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
 * When `pieceIndices` is given, only those pieces (by col-major flat index) are
 * cut and returned; the rest are skipped before any boolean work. The full bin
 * solid is still generated (it's the input to every cut), but the per-piece
 * intersect — the dominant split cost — runs only for the requested pieces.
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
  splitConnectorConfig?: SplitConnectorConfig,
  pieceIndices?: ReadonlySet<number>
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

  // Per-axis pitch: X scales width / vertical cut planes, Y scales depth /
  // horizontal cut planes. Equal for a square grid.
  const { x: gridUnitMmX, y: gridUnitMmY } = pitchFromParams(params);
  const outerW = params.width * gridUnitMmX - CLEARANCE;
  const outerD = params.depth * gridUnitMmY - CLEARANCE;

  // Lightweight bins have no solid floor for the 45° floor scarf to bite into —
  // cut planes are shifted mid-cell, landing over the hollow cup recesses, so the
  // scarf loft has little/no material (fragmented, weak, or a failed loft). Force
  // the floor scarf off and keep wall "key" connectors (those sit in the solid
  // walls and are unaffected).
  const rawConnectorConfig = splitConnectorConfig ?? params.splitConnectors;
  const liteBase = params.base.lightweight && params.base.style !== 'flat';
  const connectorConfig =
    rawConnectorConfig && liteBase ? { ...rawConnectorConfig, enabled: false } : rawConnectorConfig;

  // Bin geometry context for connector placement
  const isFlat = params.base.style === 'flat';
  const totalHeight = params.height * params.heightUnitMm;
  const wallHeight = isFlat ? totalHeight : totalHeight - SOCKET_HEIGHT;
  const floorZ = isFlat ? 0 : SOCKET_HEIGHT;
  const wallTopZ = floorZ + wallHeight;

  // An overhang grows the outer body past the nominal grid footprint (#1949);
  // both the lip and the outermost cutting boxes must track it. Suppressed for
  // partial masks, matching the geometry pipeline.
  const overhang = resolveOverhang(isPartialMask(params.cellMask) ? undefined : params.overhang);

  // Build lip solid separately if needed. The lip is positioned at
  // wallTopZ (= totalHeight for both flat and socket bases after the
  // socket Z-offset applied in generateBin), shifted down by
  // LIP_FUSE_OVERLAP to ensure a volumetric overlap for clean fusing.
  //
  // Pass cellMask + overhang so the lip footprint matches the body. A no-op for
  // a plain rectangular bin with no overhang; for a custom shape (L/U) or any
  // overhang it avoids a full-rectangle, nominal-size lip that juts past or
  // falls short of the actual body edge once fused per-piece.
  let lipSolid: Shape3D | undefined;
  if (hasLip) {
    const lipBase = buildTopShape(
      params.width,
      params.depth,
      true,
      { x: gridUnitMmX, y: gridUnitMmY },
      params.cellMask,
      overhang
    );
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

    // Same situation for wall cutouts: the body got its wall cutouts via the
    // normal pipeline on bodyParams (where dim.hasLip=false, so the cutters
    // only overshoot the wall top by 2mm). The freshly-built lip would
    // otherwise still seal off the opening that should pass cleanly through
    // both wall and lip. Pass hasLip=true so the cutters extend through the
    // full lip zone, then shift them up by floorZ to convert body-local Z
    // (floor at Z=0) into absolute bin Z (socket bottom at Z=0).
    if (params.walls.enabled) {
      const innerW = outerW - 2 * params.wallThickness;
      const innerD = outerD - 2 * params.wallThickness;
      const wallCuts = buildWallCutoutCuts(params, innerW, innerD, wallHeight, true);
      if (wallCuts) {
        let positioned = wallCuts;
        if (floorZ !== 0) {
          positioned = translate(wallCuts, [0, 0, floorZ]);
          wallCuts.delete();
        }
        try {
          const newLip = unwrap(cut(lipSolid as ValidSolid, positioned as ValidSolid));
          lipSolid.delete();
          lipSolid = newLip;
        } finally {
          positioned.delete();
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
  const adjustedCutPlanesX = shiftCutPlanesOffCellBoundaries(cutPlanesX, params.width, gridUnitMmX);
  const adjustedCutPlanesY = shiftCutPlanesOffCellBoundaries(cutPlanesY, params.depth, gridUnitMmY);

  // The outermost cutting boxes must reach the overhung body edges (resolved
  // above) or the boolean intersect clips the overhang off (#1949). The body
  // spans [-outerW/2 - left, outerW/2 + right] and [-outerD/2 - front,
  // outerD/2 + back].
  // Boundary arrays: [left edge, ...cut planes, right edge]
  const xBounds = [-outerW / 2 - overhang.left, ...adjustedCutPlanesX, outerW / 2 + overhang.right];
  const yBounds = [-outerD / 2 - overhang.front, ...adjustedCutPlanesY, outerD / 2 + overhang.back];

  // Outer edges of the cutting box are expanded by this margin to avoid
  // coplanar faces with bin geometry, which cause OCCT booleans to
  // silently drop outer walls.
  const EDGE_MARGIN = 1;

  // Interior cut faces still get a small overlap to defeat coplanarity
  // tolerance at the cut. With shiftCutPlanesOffCellBoundaries() above,
  // the cut plane itself is already off any cell wall — this offset is the
  // belt to the suspenders of the cell-boundary shift.
  const INTERIOR_MARGIN = 0.01;

  const numCols = xBounds.length - 1;
  const numRows = yBounds.length - 1;

  const pieces: SplitPieceInfo[] = [];

  try {
    // Validate requested indices against the col-major flat index space
    // (flatIndex = col * numRows + row), matching the pool's distributeRoundRobin.
    // Must run inside the try so the finally still disposes lipSolid and resets
    // the shape cache on a bad index (a lipped bin would otherwise leak lipSolid
    // and leave the lipless body solid cached as export-quality).
    if (pieceIndices) {
      for (const idx of pieceIndices) {
        if (idx < 0 || idx >= numCols * numRows) {
          throw new Error(`Piece index ${idx} out of range [0, ${numCols * numRows})`);
        }
      }
    }

    for (let col = 0; col < numCols; col++) {
      for (let row = 0; row < numRows; row++) {
        // Skip the expensive boolean cut for pieces this caller didn't ask
        // for. Each pool worker only builds the pieces it will tessellate, so
        // the per-piece intersect cost (the split bottleneck) is no longer
        // duplicated across every worker.
        if (pieceIndices && !pieceIndices.has(col * numRows + row)) continue;

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
        // The Z extent comes out far shorter than the bin height in two cases:
        // (1) on a HOLLOW bin, a piece bounded by interior cuts on all four
        // sides sits entirely inside the open cavity, so it legitimately has
        // only a floor and no walls — not a bug; (2) OCCT dropped walls because
        // a cut plane went coplanar with an internal wall — a bug worth
        // reporting. A solid bin has no cavity, so case (1) can't apply to it.
        const pieceBounds = getBounds(piece);
        const actualZ = pieceBounds.zMax - pieceBounds.zMin;
        if (actualZ < totalHeight * 0.8) {
          piece.delete();
          cuttingBox.delete();
          const isFullyInterior = col > 0 && col < numCols - 1 && row > 0 && row < numRows - 1;
          if (isFullyInterior && !params.base.solid) {
            throw new Error(
              `Split piece ${colLabel}${row + 1} falls entirely inside this bin's open cavity, ` +
                `so it has only a ${actualZ.toFixed(1)}mm floor and no walls to print. ` +
                `Split the bin into strips (cut along one axis only) so every piece keeps a ` +
                `perimeter wall, or make it a solid bin if you need a full grid of pieces.`
            );
          }
          throw new Error(
            `Split piece ${colLabel}${row + 1} lost geometry: ` +
              `expected body Z≈${totalHeight.toFixed(1)}mm (lip fused separately), got ${actualZ.toFixed(1)}mm. ` +
              `This usually means a cut plane landed coplanar with an internal wall — please report this bug.`
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

        // Alignment connectors (floor scarf) and wall connectors are independent
        // toggles — apply when either is on; each feature self-gates inside the builder.
        if (
          connectorConfig &&
          (connectorConfig.enabled || connectorConfig.wallConnector === 'key')
        ) {
          const cutFaces = computeCutFaces(
            col,
            row,
            adjustedCutPlanesX,
            adjustedCutPlanesY,
            // True body edges (overhang-inclusive) are the outermost cut bounds,
            // so connectors land on overhung walls too (#1949).
            xBounds[0],
            xBounds[xBounds.length - 1],
            yBounds[0],
            yBounds[yBounds.length - 1],
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
            nozzleSizeMm: connectorConfig.nozzleSizeMm,
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
 * `STL_EXPORT_FAILED` regardless of tolerance (issue #1760).
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

/** Tessellate a split piece into preview mesh data */
function tessellatePiece(
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

/**
 * Export the cached (or regenerated) bin solid, split into pieces via boolean cuts.
 *
 * Each piece is independently tessellated to STL. If tessellation throws
 * partway through, the remaining piece solids are still disposed so we don't
 * leak WASM memory.
 *
 * `async` is intentional even though the body has no `await` — it keeps the
 * error-delivery contract (throws arrive as rejected promises) consistent
 * with the declared return type, matching what every caller expects.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- see fn doc
export async function exportSplitBin(
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  tolerance = 0.01,
  angularTolerance = 5,
  splitConnectorConfig?: SplitConnectorConfig
): Promise<SplitExportResult> {
  const splitPieces = splitSolidIntoPieces(params, cutPlanesX, cutPlanesY, splitConnectorConfig);
  const pitch = pitchFromParams(params);
  const outerW = params.width * pitch.x - CLEARANCE;
  const outerD = params.depth * pitch.y - CLEARANCE;

  const pieces: SplitExportResult['pieces'] = [];
  let nextIdx = 0;
  try {
    for (; nextIdx < splitPieces.length; nextIdx++) {
      const piece = splitPieces[nextIdx];
      const data = tessellateAndExportPiece(
        piece,
        params,
        outerW,
        outerD,
        tolerance,
        angularTolerance
      );
      pieces.push({ data, label: piece.label, col: piece.col, row: piece.row });
    }
  } finally {
    // tessellateAndExportPiece disposes the solid it processed (including on
    // throw, via its own try/finally). Clean up any pieces past that point
    // that were never handed off.
    for (let i = nextIdx + 1; i < splitPieces.length; i++) {
      splitPieces[i].solid.delete();
    }
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
  const pitch = pitchFromParams(params);
  const outerW = params.width * pitch.x - CLEARANCE;
  const outerD = params.depth * pitch.y - CLEARANCE;

  return {
    pieces: splitPieces.map((piece) => tessellatePiece(piece, params, outerW, outerD, pitch)),
  };
}

/**
 * Generate split preview meshes for a subset of pieces.
 *
 * Each pool worker calls this with its assigned pieceIndices. The full solid
 * is regenerated per worker (each has independent WASM), but only the assigned
 * pieces are cut and tessellated — the per-piece boolean cut is the dominant
 * split cost, so skipping unassigned pieces is what makes the pool scale.
 */
export function generateSplitPreviewRange(
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  pieceIndices: readonly number[],
  splitConnectorConfig?: SplitConnectorConfig
): SplitPreviewResult {
  const splitPieces = splitSolidIntoPieces(
    params,
    cutPlanesX,
    cutPlanesY,
    splitConnectorConfig,
    new Set(pieceIndices)
  );
  const pitch = pitchFromParams(params);
  const outerW = params.width * pitch.x - CLEARANCE;
  const outerD = params.depth * pitch.y - CLEARANCE;

  // splitPieces are exactly the requested pieces (cut-skipped otherwise);
  // tessellate them all. The pool re-sorts by col/row, so order is irrelevant.
  return {
    pieces: splitPieces.map((piece) => tessellatePiece(piece, params, outerW, outerD, pitch)),
  };
}

/**
 * Export split bin pieces for a subset of piece indices.
 *
 * Same as exportSplitBin but only processes the assigned pieces, allowing
 * parallel export across multiple workers. Pieces outside `pieceIndices` are
 * always disposed (even if export throws midway through) to keep WASM
 * memory bounded.
 *
 * `async` is intentional — same rationale as exportSplitBin's doc.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- see fn doc
export async function exportSplitBinRange(
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  pieceIndices: readonly number[],
  tolerance = 0.01,
  angularTolerance = 5,
  splitConnectorConfig?: SplitConnectorConfig
): Promise<SplitExportResult> {
  const splitPieces = splitSolidIntoPieces(
    params,
    cutPlanesX,
    cutPlanesY,
    splitConnectorConfig,
    new Set(pieceIndices)
  );
  const pitch = pitchFromParams(params);
  const outerW = params.width * pitch.x - CLEARANCE;
  const outerD = params.depth * pitch.y - CLEARANCE;

  // splitPieces are exactly the requested pieces — export them all.
  const pieces: SplitExportResult['pieces'] = [];
  let nextIdx = 0;
  try {
    for (; nextIdx < splitPieces.length; nextIdx++) {
      const piece = splitPieces[nextIdx];
      const data = tessellateAndExportPiece(
        piece,
        params,
        outerW,
        outerD,
        tolerance,
        angularTolerance
      );
      pieces.push({ data, label: piece.label, col: piece.col, row: piece.row });
    }
  } finally {
    // tessellateAndExportPiece disposes the solid it processed (including on
    // throw). Dispose any pieces past that point that were never handed off.
    for (let i = nextIdx + 1; i < splitPieces.length; i++) {
      splitPieces[i].solid.delete();
    }
  }

  return { pieces };
}
