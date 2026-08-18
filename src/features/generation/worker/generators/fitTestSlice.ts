/**
 * Cutout fit-test card — a horizontal slice of the bin's own top.
 *
 * The card is cut out of the solid the exporter ships, not rebuilt from the
 * cutout list, so it carries every opening at its real size, position, spacing
 * and entry chamfer, plus engraved labels, arrays, group booleans and scanned
 * mesh imprints. Anything reaching the band is on the card because it is the
 * same geometry; there is nothing here to drift from `cutoutBuilder`.
 *
 * Two consequences of slicing rather than restating:
 *
 *  - Depth behaviour is free. A pocket shallower than the card keeps its real
 *    floor (the material under it survives the intersect); a deeper one becomes
 *    a through hole. No per-cutout branch exists.
 *  - Orientation is the bin's. The cut plane lands on the bed and the opening,
 *    the face that decides fit, prints at the top of the card exactly as it
 *    does at the top of a 40mm bin. Flipping the card to save time would put
 *    that face in the first layers, where squish reads tight.
 *
 * The band's top is the SOLID FILL SURFACE, not the rim: `wallTopZ` also
 * carries the exterior-wall collar, which stands proud of the material the
 * cutouts are cut into. It is reached by subtracting named dimensions from
 * `wallTopZ` rather than restating the height chain (gotcha #14), and taking it
 * from there drops the stacking lip for free, since the lip lives above the rim.
 *
 * Mesh imprints follow the split-export route exactly: they never exist on the
 * BREP solid, so the card is cut in BREP and each piece is imprinted after
 * tessellation.
 */

import {
  box,
  cut,
  exportSTEP,
  getBounds,
  intersect,
  mesh,
  mirror,
  unwrap,
  withScope,
} from 'brepjs';
import type { Shape3D, ValidSolid, DisposalScope } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import {
  clampFitTestThicknessMm,
  fitTestStampLines,
  planFitTestSplit,
  planFitTestStampArea,
  type FitTestSplitPlan,
  type FitTestStampContext,
} from '@/shared/utils/fitTestPlan';
import { getSplitPlanePositionsMm } from '@/shared/utils/splitPositions';
import type { ExportFormat } from '../../bridge/types';
import { generateBin } from './binOrchestrator';
import { getLastSolid } from './shapeCache';
import { deriveDimensions } from './pipeline/context';
import { buildTextSolid } from './textBuilder';
import { DEFAULT_TEXT_STYLE_DEFAULTS } from '@/shared/types/bin';
import { hasMeshImprints, imprintPieceArrays, prepareMeshImprints } from './meshImprint';
import { buildSTLBufferFromIndexed } from '../../export/stlExporter';
import { EXPORT_ANGULAR_TOLERANCE, EXPORT_TOLERANCE } from './utils/tolerances';
import { unwrapExportBlob } from './utils/exportUnwrap';

/** XY margin on the band box, so the intersect bounds material in Z only. A
 *  perimeter can sit outside the nominal extent under overhang or a custom
 *  shape (gotcha #8), and this card must never be the thing that clips it. */
const BAND_BOX_XY_MARGIN_MM = 200;

/** Depth of the underside stamp (mm). Deep enough to read, shallow enough that
 *  it never approaches the thinnest card the field allows. */
const STAMP_DEPTH_MM = 0.4;
/** Per-line height budget for the stamp (mm), including leading. */
const STAMP_LINE_MM = 4;
const STAMP_MIN_FONT_MM = 2;
const STAMP_MAX_FONT_MM = 3.4;

export interface FitTestSliceOptions {
  /** Card thickness (mm). Clamped to the range this design allows. */
  readonly thicknessMm?: number;
  /** Design name and piece label for the underside stamp. */
  readonly stamp?: FitTestStampContext;
  /**
   * Print bed (mm). When the card overflows it the card is split, with seams
   * nudged clear of the openings. Omitted leaves the card whole.
   */
  readonly bed?: { readonly width: number; readonly depth: number };
}

/** One piece of a fit-test card. A whole card is a single piece labelled ''. */
interface FitTestPiece {
  readonly solid: Shape3D;
  readonly label: string;
}

interface FitTestPieces {
  readonly pieces: FitTestPiece[];
  /** Seams left crossing an opening because no clear position was reachable. */
  readonly blockedSeams: number;
}

/**
 * Deboss one line into the card's underside, mirrored so it reads when the card
 * is turned over. Best-effort: a line that will not fit is skipped rather than
 * costing the card, matching how `labelFitSample` degrades its label.
 */
function stampLine(
  scope: DisposalScope,
  card: Shape3D,
  line: string,
  centerX: number,
  centerY: number,
  availW: number,
  bottomZ: number,
  thicknessMm: number
): Shape3D {
  // `emboss` at the bottom plane builds the volume from the underside upward,
  // which is exactly the material a deboss removes.
  const text = buildTextSolid(scope, {
    text: line,
    style: {
      ...DEFAULT_TEXT_STYLE_DEFAULTS,
      font: 'jetbrains-mono',
      mode: 'emboss',
      depth: STAMP_DEPTH_MM,
      margin: 0,
      minFontSize: STAMP_MIN_FONT_MM,
      maxFontSize: STAMP_MAX_FONT_MM,
    },
    availW,
    availD: STAMP_LINE_MM,
    // Negated: the glyphs are pre-mirrored across x=0 below, which carries a
    // solid centred at -c to +c. The card itself is never mirrored, so its
    // own centre (offset by asymmetric overhang) is where the run must land.
    centerX: -centerX,
    centerY,
    topZ: bottomZ,
    depth: STAMP_DEPTH_MM,
    hostThickness: thicknessMm,
  });
  if (!text) return card;

  // Flipping the card about Y maps x to -x, so glyphs cut in their natural
  // orientation would read backwards. Pre-mirroring is the only fix: a rotation
  // cannot produce a reflection.
  const flipped = scope.register(mirror(text.solid, { normal: [1, 0, 0] }));
  const result = cut(card as ValidSolid, flipped as ValidSolid);
  return result.ok ? scope.register(result.value) : card;
}

/** Cut the band out of an already-generated bin solid and stamp its underside. */
function buildCard(
  scope: DisposalScope,
  solid: Shape3D,
  params: BinParams,
  thicknessMm: number,
  stamp: FitTestStampContext,
  split: FitTestSplitPlan
): Shape3D {
  const dims = deriveDimensions(params, true);
  // The rim is NOT the fill surface. `wallTopZ` is
  // `baseOffsetZ + wallHeight + tileFloorHeight + collarHeight`, while
  // `buildCutoutCuts` places every tool against `wallHeight - topOffset` — so an
  // exterior-wall collar (`extraWallHeightMm`) raises the rim above the material
  // the cutouts are cut into. Anchoring the band to the rim put the card mostly
  // above its own openings: a 3mm collar left a 4mm card with 1mm-deep holes,
  // and a collar at or past the thickness left a card with no openings at all —
  // still a valid, plausibly-sized export.
  //
  // Subtracted from `wallTopZ` by named dimensions rather than restating the
  // `baseOffsetZ + wallHeight` chain (gotcha #14).
  const topZ =
    dims.wallTopZ - dims.collarHeight - dims.tileFloorHeight - params.cutoutConfig.topOffset;
  const bottomZ = topZ - thicknessMm;

  const bounds = getBounds(solid);
  const bandBox = scope.register(
    box(
      bounds.xMax - bounds.xMin + 2 * BAND_BOX_XY_MARGIN_MM,
      bounds.yMax - bounds.yMin + 2 * BAND_BOX_XY_MARGIN_MM,
      thicknessMm,
      {
        at: [
          (bounds.xMin + bounds.xMax) / 2,
          (bounds.yMin + bounds.yMax) / 2,
          (bottomZ + topZ) / 2,
        ],
      }
    )
  );
  let card: Shape3D = scope.register(unwrap(intersect(solid, bandBox)));

  const lines = fitTestStampLines(params, thicknessMm, stamp);
  // The split plan is passed in so the stamp lands whole on one piece rather
  // than being bisected by a seam — the same plan the cuts below use.
  const area = planFitTestStampArea(
    params,
    thicknessMm,
    lines.length * STAMP_LINE_MM,
    STAMP_DEPTH_MM,
    split
  );
  if (!area) return card;

  lines.forEach((line, i) => {
    // First line at the LARGEST Y: turning the printed card over to read its
    // underside flips left-right and keeps Y, so the back-most line is the
    // top one and the lines read top-down.
    const centerY = area.centerY + (lines.length / 2 - 0.5 - i) * STAMP_LINE_MM;
    card = stampLine(scope, card, line, area.centerX, centerY, area.availW, bottomZ, thicknessMm);
  });
  return card;
}

/** Cut the card into bed-fitting pieces, using the same plan the export dialog
 *  warns from — so the two cannot disagree about where the seams land. */
function splitCard(scope: DisposalScope, card: Shape3D, plan: FitTestSplitPlan): FitTestPieces {
  if (plan.pieceCount <= 1) return { pieces: [{ solid: card, label: '' }], blockedSeams: 0 };

  const bounds = getBounds(card);
  const xEdges = [bounds.xMin - 1, ...plan.planesX, bounds.xMax + 1];
  const yEdges = [bounds.yMin - 1, ...plan.planesY, bounds.yMax + 1];

  const pieces: FitTestPiece[] = [];
  for (let row = 0; row < yEdges.length - 1; row++) {
    for (let col = 0; col < xEdges.length - 1; col++) {
      const [x0, x1] = [xEdges[col], xEdges[col + 1]];
      const [y0, y1] = [yEdges[row], yEdges[row + 1]];
      const cutter = scope.register(
        box(x1 - x0, y1 - y0, bounds.zMax - bounds.zMin + 2, {
          at: [(x0 + x1) / 2, (y0 + y1) / 2, (bounds.zMin + bounds.zMax) / 2],
        })
      );
      const piece = intersect(card, cutter);
      // A failed cut must not quietly shorten the set: the ZIP would carry a
      // card with a chunk missing that looks like a normal split. The named
      // throw surfaces as a toast, exactly as the bin splitter's does.
      const label = `${String.fromCharCode(65 + col)}${row + 1}`;
      if (!piece.ok) throw new Error(`Fit-test piece ${label} failed to cut`);
      pieces.push({
        solid: scope.register(piece.value),
        label,
      });
    }
  }
  return { pieces, blockedSeams: plan.blockedSeams };
}

/** Cut the fit-test card, splitting it when a bed is given and it overflows. */
function buildFitTestPieces(
  scope: DisposalScope,
  params: BinParams,
  thicknessMm: number,
  options: FitTestSliceOptions
): FitTestPieces {
  generateBin(params, undefined, true);
  const solid = getLastSolid();
  if (!solid) throw new Error('Failed to generate solid for the fit test card');

  // One plan for both halves of the job: the stamp keeps clear of the seams
  // the split will cut, so the two cannot disagree.
  const plan = planFitTestSplit(params, options.bed, getSplitPlanePositionsMm);
  const card = buildCard(scope, solid, params, thicknessMm, options.stamp ?? {}, plan);
  if (!options.bed) return { pieces: [{ solid: card, label: '' }], blockedSeams: 0 };

  const bounds = getBounds(card);
  const fits =
    bounds.xMax - bounds.xMin <= options.bed.width &&
    bounds.yMax - bounds.yMin <= options.bed.depth;
  if (fits) return { pieces: [{ solid: card, label: '' }], blockedSeams: 0 };

  return splitCard(scope, card, plan);
}

/** One tessellated piece of the card. */
export interface FitTestMeshPiece {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly label: string;
}

/** Tessellate one piece and apply any mesh imprints, exactly as split export
 *  does: the pockets never exist on the BREP solid, so they are subtracted here
 *  or not at all. */
function pieceToMesh(piece: FitTestPiece, params: BinParams, imprinted: boolean): FitTestMeshPiece {
  const m = mesh(piece.solid, {
    tolerance: EXPORT_TOLERANCE,
    angularTolerance: EXPORT_ANGULAR_TOLERANCE,
    cache: false,
  });
  let vertices = m.vertices instanceof Float32Array ? m.vertices : new Float32Array(m.vertices);
  let normals = m.normals instanceof Float32Array ? m.normals : new Float32Array(m.normals);
  let indices = m.triangles instanceof Uint32Array ? m.triangles : new Uint32Array(m.triangles);

  if (imprinted) {
    const b = getBounds(piece.solid);
    const result = imprintPieceArrays(vertices, indices, params, deriveDimensions(params, true), {
      minX: b.xMin,
      minY: b.yMin,
      maxX: b.xMax,
      maxY: b.yMax,
    });
    if (result) {
      vertices = result.positions;
      normals = result.normals;
      indices = result.indices;
    }
  }
  return { vertices, normals, indices, label: piece.label };
}

/**
 * The tessellated fit-test card, which is what the STL export writes and what
 * a caller measuring the card has to look at.
 *
 * A design with mesh imprints must have had `prepareMeshImprints` awaited
 * first: the tool manifolds are loaded asynchronously and the pipeline that
 * consumes them is synchronous. `exportFitTestSlice` does that for its callers.
 */
export function buildFitTestMeshes(
  params: BinParams,
  options: FitTestSliceOptions = {}
): { pieces: FitTestMeshPiece[]; blockedSeams: number } {
  const imprinted = hasMeshImprints(params);
  const thicknessMm = clampFitTestThicknessMm(params, options.thicknessMm ?? NaN);
  return withScope((scope: DisposalScope) => {
    const { pieces, blockedSeams } = buildFitTestPieces(scope, params, thicknessMm, options);
    return { pieces: pieces.map((p) => pieceToMesh(p, params, imprinted)), blockedSeams };
  });
}

/** Result of a fit-test export: one file per piece, plus what the caller has to
 *  tell the user about how it was cut. */
export interface FitTestExportResult {
  readonly pieces: Array<{ readonly data: ArrayBuffer; readonly label: string }>;
  readonly fileName: string;
  /** Seams that had to cross an opening. Non-zero means the card is split
   *  through a cutout and the user must be told. */
  readonly blockedSeams: number;
}

/** Base file name for a fit-test card. */
export const FIT_TEST_BASE_NAME = 'fit-test';

/**
 * Export the fit-test card.
 *
 * Mirrors `exportBin`'s format policy exactly: a design with mesh imprints has
 * its pockets subtracted post-tessellation, so no solid describes them and STEP
 * is refused rather than shipping a valid, plausibly-sized file that quietly
 * lost every scanned pocket (gotcha #20).
 */
export async function exportFitTestSlice(
  params: BinParams,
  format: ExportFormat,
  options: FitTestSliceOptions = {}
): Promise<FitTestExportResult> {
  const imprinted = hasMeshImprints(params);
  if (imprinted && format === 'step') {
    throw new Error(
      'STEP export is not available for designs with mesh imprint cutouts — use STL or 3MF'
    );
  }
  if (imprinted) await prepareMeshImprints(params);

  const thicknessMm = clampFitTestThicknessMm(params, options.thicknessMm ?? NaN);

  // Every kernel object is built and consumed inside this scope. `withScope` is
  // synchronous, so a STEP Blob (not a kernel object) leaves the scope and is
  // read afterwards — awaiting inside would dispose the solids mid-flight.
  const built = withScope(
    (
      scope: DisposalScope
    ): {
      blobs?: Array<{ blob: Blob; label: string }>;
      buffers?: Array<{ data: ArrayBuffer; label: string }>;
      blockedSeams: number;
    } => {
      const { pieces, blockedSeams } = buildFitTestPieces(scope, params, thicknessMm, options);

      if (format === 'step') {
        return {
          blobs: pieces.map((piece) => ({
            blob: unwrapExportBlob(exportSTEP(piece.solid), 'STEP'),
            label: piece.label,
          })),
          blockedSeams,
        };
      }
      return {
        buffers: pieces.map((piece) => {
          const m = pieceToMesh(piece, params, imprinted);
          return {
            data: buildSTLBufferFromIndexed(m.vertices, m.normals, m.indices, FIT_TEST_BASE_NAME),
            label: piece.label,
          };
        }),
        blockedSeams,
      };
    }
  );

  if (built.blobs) {
    const pieces = await Promise.all(
      built.blobs.map(async (b) => ({ data: await b.blob.arrayBuffer(), label: b.label }))
    );
    return { pieces, fileName: `${FIT_TEST_BASE_NAME}.step`, blockedSeams: built.blockedSeams };
  }
  return {
    pieces: built.buffers ?? [],
    fileName: `${FIT_TEST_BASE_NAME}.stl`,
    blockedSeams: built.blockedSeams,
  };
}
