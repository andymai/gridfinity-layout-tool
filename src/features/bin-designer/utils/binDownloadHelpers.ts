/**
 * Helpers extracted from `useExport.ts` to keep the hook under the project's
 * 500-line cap. These are pure functions that translate between worker output
 * (STL ArrayBuffers + face groups) and concrete download formats (3MF, STEP,
 * STL ZIP). They have no dependency on React or store state — callers pass in
 * whatever they need.
 */

import { isErr, getUserMessage } from '@/core/result';
import { GITHUB_ISSUES_URL } from '@/shared/constants/links';
import { export3MF, export3MFMultiObject } from '@/shared/generation/export';
import { captureException } from '@/shared/analytics/posthog';
import {
  getActiveBridge,
  workerPoolManager,
  type SplitExportResult,
} from '@/shared/generation/bridge';
import type { SplitConnectorConfig } from '@/shared/types/bin';
import type {
  ThreeMFColorConfig,
  ThreeMFObject,
  ThreeMFPrintSettings,
} from '@/shared/generation/export';
import { parseSTLBinary } from '@/features/bin-designer/utils/stlParser';
import { buildTriangleMaterialIndices } from '@/features/bin-designer/utils/materialMapping';
import { enumerateCutoutColorUnits, anyCutoutColored } from '@/shared/generation/cutoutColorUnits';
import {
  anyCompartmentColored,
  planCompartmentColors,
} from '@/features/bin-designer/utils/compartmentColorUnits';
import {
  collapseLidLipCell,
  computeActiveZones,
  getZoneColor,
  normalizeHex,
  resolveColorMapping,
} from '@/features/bin-designer/types/featureColors';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';
import {
  classifyLipBand,
  classifyLipCorner,
  computeLidLipGeom,
} from '@/features/bin-designer/utils/lipCornerClassifier';
import { FeatureTag } from '@/shared/types/generation';
import type { FaceGroupData } from '@/shared/types/generation';
import { packagePiecesAsZip } from '@/shared/generation/zipExport';
import { FORMAT_MIME_TYPES } from '@/shared/generation/exportUtils';
import type { BinParams, ExportFileFormat } from '@/features/bin-designer/types';
import type { CombinedExportResult, ExportFormat } from '@/shared/generation/bridge';

/** Map piece labels from the worker to descriptive display names for 3MF/STEP. */
export function formatPieceDisplayName(
  label: string,
  params: { width: number; depth: number; height: number }
): string {
  const dims = `${params.width}x${params.depth}x${params.height}`;
  switch (label) {
    case 'bin':
      return `Bin ${dims}`;
    case 'lid':
      return `Lid ${dims}`;
    case 'lid-baseplate':
      return `Lid Baseplate ${dims}`;
    case 'slide-tray':
      return `Sliding Tray ${dims}`;
    case 'feet':
      return `Feet ${dims}`;
    case 'knife-rest':
      return `Handle Rest ${dims}`;
    case 'divider-horizontal':
      return 'Divider Horizontal';
    case 'divider-vertical':
      return 'Divider Vertical';
    case 'assembly':
      return `Bin ${dims} Assembly`;
    default:
      return label;
  }
}

/**
 * Build a GitHub issue URL with bin params + error class prefilled. Lets the
 * "Report issue" toast action drop users into a complete bug report instead
 * of asking them to copy/paste failure context.
 *
 * The snapshot covers every BinParams field that materially affects the
 * generated solid (so reports are reproducible). Fields added carelessly
 * here will balloon the URL — keep the shape compact and prefer counts /
 * enabled flags over full nested config when the nested data is large.
 */
export function buildReportIssueUrl(
  params: BinParams,
  error: Error,
  format: ExportFileFormat
): string {
  const title = `Bin export failed: ${error.name || 'Error'}`;
  const body = [
    '**Format:** ' + format.toUpperCase(),
    '**Error:** ' + error.message,
    '',
    '**Bin params:**',
    '```json',
    JSON.stringify(
      {
        width: params.width,
        depth: params.depth,
        height: params.height,
        gridUnitMm: params.gridUnitMm,
        heightUnitMm: params.heightUnitMm,
        wallThickness: params.wallThickness,
        style: params.style,
        base: { style: params.base.style, stackingLip: params.base.stackingLip },
        compartments: {
          cols: params.compartments.cols,
          rows: params.compartments.rows,
          // Duplicate IDs = at least two cells share a compartment. Robust
          // against renumbered-but-unmerged designs (where a positional
          // `id !== i` check would false-positive).
          merged: new Set(params.compartments.cells).size !== params.compartments.cells.length,
        },
        scoop: params.scoop.enabled
          ? {
              enabled: true,
              radius: params.scoop.radius,
              run: params.scoop.run,
              style: params.scoop.style,
              autoMaxHeight: params.scoop.autoMaxHeight,
            }
          : false,
        label: params.label.enabled
          ? { enabled: true, support: params.label.support, depth: params.label.depth }
          : false,
        wallPattern: params.wallPattern.enabled ? params.wallPattern.pattern : null,
        walls: params.walls.enabled ? { shape: params.walls.shape } : false,
        handles: params.handles.enabled,
        cutouts: params.cutouts.length,
        inserts: params.inserts.length,
        lid: params.lid.enabled,
        featureColors: params.featureColors.enabled,
      },
      null,
      2
    ),
    '```',
  ].join('\n');
  const url = new URL(`${GITHUB_ISSUES_URL}/new`);
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  url.searchParams.set('labels', 'bin-export-failure');
  return url.toString();
}

/**
 * Convert a single STL piece into a 3MF Blob. Throws on malformed STL input
 * (the pipeline should never produce one — but the worker boundary is a real
 * place for shape drift, so the parse is checked).
 *
 * `applyMultiColor` controls whether multi-color material indices are
 * computed; callers want this on for the bin piece and off for ancillary
 * pieces (dividers, lid).
 */
export function buildSinglePiece3MF(
  pieceData: ArrayBuffer,
  faceGroups: CombinedExportResult['faceGroups'],
  params: BinParams,
  modelName: string,
  threeMFPrintSettings: ThreeMFPrintSettings,
  applyMultiColor: boolean
): Blob {
  const object = buildSinglePiece3MFObject(
    pieceData,
    faceGroups,
    params,
    modelName,
    applyMultiColor
  );
  return export3MF(object.vertices, object.normals, {
    name: modelName,
    colorConfig: object.colorConfig,
    printSettings: threeMFPrintSettings,
  });
}

/**
 * The coloured mesh behind {@link buildSinglePiece3MF}, before it is sealed
 * into a file. Exposed so a whole-layout PROJECT export can carry the same
 * `colorConfig` into a shared multi-plate file instead of re-deriving it (or,
 * worse, shipping the part uncoloured).
 */
export function buildSinglePiece3MFObject(
  pieceData: ArrayBuffer,
  faceGroups: CombinedExportResult['faceGroups'],
  params: BinParams,
  modelName: string,
  applyMultiColor: boolean
): ThreeMFObject {
  const parseResult = parseSTLBinary(pieceData);
  if (isErr(parseResult)) {
    throw new Error(getUserMessage(parseResult.error));
  }
  let { vertices, normals } = parseResult.value;

  let colorConfig: ThreeMFColorConfig | undefined;
  /* eslint-disable @typescript-eslint/no-unnecessary-condition -- faceGroups is typed non-null, but runtime guard is intentional belt-and-suspenders against shape drift in the generation pipeline */
  if (
    applyMultiColor &&
    (params.featureColors?.enabled ||
      anyCutoutColored(params.cutouts) ||
      anyCompartmentColored(params)) &&
    faceGroups
  ) {
    /* eslint-enable @typescript-eslint/no-unnecessary-condition */
    const triangleCount = vertices.length / 9;
    const mapping = buildTriangleMaterialIndices(
      faceGroups,
      params.featureColors,
      triangleCount,
      vertices,
      computeActiveZones(params),
      enumerateCutoutColorUnits(params.cutouts),
      planCompartmentColors(params)
    );
    if (mapping) {
      colorConfig = mapping.config;
      // A split lip grid re-tessellates the lip; use the replacement geometry
      // so triangle count matches the per-triangle paint_color indices.
      if (mapping.vertices && mapping.normals) {
        vertices = mapping.vertices;
        normals = mapping.normals;
      }
    }
  }

  return { vertices, normals, name: modelName, colorConfig };
}

/** Map ancillary piece label → the ColorZone whose color paints the piece. */
function pieceZone(label: string): ColorZone | null {
  // The glue-on baseplate is part of the lid assembly, so it takes the lid color.
  if (label === 'lid' || label === 'lid-baseplate') return 'lid';
  if (label === 'divider-horizontal' || label === 'divider-vertical') return 'dividers';
  // The feet are the bin's base, printed separately, so they take the Base
  // colour rather than falling through to the default material. The knife
  // block's handle rest has no zone of its own and stands on the same
  // baseplate, so it takes Base too rather than the default material.
  if (label === 'feet' || label === 'knife-rest') return 'base';
  return null;
}

/** Labels laid out in a row to the right of the bin in multi-object 3MF. */
function isSideLaidOutPiece(label: string): boolean {
  // Every piece that is a separate PRINT is laid out beside the bin rather than
  // left in the frame it was built in. The tray would otherwise overlap the
  // cavity it rides in; the feet, whose export frame starts at the first foot's
  // own origin, would sit inside the bin's floor band; the handle rest is
  // exported centred on itself, so it would land inside the block.
  return (
    label === 'lid' ||
    label === 'lid-baseplate' ||
    label === 'slide-tray' ||
    label === 'feet' ||
    label === 'knife-rest'
  );
}

/** Bounding box of a flat [x,y,z,x,y,z,...] STL vertex array. */
interface FlatBBox {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}
function flatBBox(vertices: Float32Array): FlatBBox {
  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1];
    const z = vertices[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

const PRINT_LAYOUT_GAP_MM = 5;

/**
 * Lay out an ancillary piece (lid, glue-on baseplate) in a row to the right of
 * the bin. Each piece arrives already in print orientation — `exportLid` /
 * `exportStackPlate` orient (or leave) it print-ready — so this only does the
 * layout: align floors, center the piece's Y on the bin's, and slide it
 * `PRINT_LAYOUT_GAP_MM` right of `cursorX` so the unified centering in
 * `build3MFMultiObjectBuffer` doesn't land pieces stacked at the same XY
 * (discussion bug #4). Returns the piece's new right edge so the next
 * ancillary piece slots beside it instead of overlapping.
 */
function layoutPieceRightOf(
  vertices: Float32Array,
  normals: Float32Array,
  binBBox: FlatBBox,
  cursorX: number
): { vertices: Float32Array; normals: Float32Array; nextCursorX: number } {
  const bbox = flatBBox(vertices);
  const binCy = (binBBox.minY + binBBox.maxY) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const tx = cursorX + PRINT_LAYOUT_GAP_MM - bbox.minX;
  const ty = binCy - cy;
  const tz = binBBox.minZ - bbox.minZ;

  const v = new Float32Array(vertices.length);
  for (let i = 0; i < vertices.length; i += 3) {
    v[i] = vertices[i] + tx;
    v[i + 1] = vertices[i + 1] + ty;
    v[i + 2] = vertices[i + 2] + tz;
  }
  const width = bbox.maxX - bbox.minX;
  return { vertices: v, normals, nextCursorX: cursorX + PRINT_LAYOUT_GAP_MM + width };
}

/**
 * Build a uniform-color colorConfig for an ancillary piece (lid or divider).
 * Materials match the bin's palette so `unifiedPalette`'s same-materials
 * invariant holds across all objects in the 3MF.
 */
function uniformColorConfig(
  zone: ColorZone,
  featureColors: BinParams['featureColors'],
  triangleCount: number
): ThreeMFColorConfig {
  const { colors, colorToIndex } = resolveColorMapping(featureColors);
  const slot = colorToIndex.get(normalizeHex(getZoneColor(featureColors, zone))) ?? 0;
  return {
    materials: colors.map((c) => ({ color: c })),
    triangleMaterialIndices: new Array(triangleCount).fill(slot),
  };
}

/**
 * Per-triangle material indices for the LID piece: its shell takes the flat
 * `lid` colour while its stack grid (`FeatureTag.LID_LIP`) is classified into
 * the `lidLip` corner × band grid, so the lid's top lip can differ from the rest
 * of the lid.
 *
 * Falls back to null when the lid carries no LID_LIP geometry (a non-stackable
 * lid has a flat top) or when the grid is uniform — the caller then keeps the
 * cheaper whole-object uniform config.
 *
 * NB: the export path flips most lids for printing (`orientForPrint`), so bands
 * are derived from the lip's OWN Z extent via `computeLipGeom` rather than from
 * world Z. Band 0 therefore tracks the lip's printed-down end, which matches how
 * the bin lip's bands are derived and keeps preview and export consistent.
 */
function lidColorConfig(
  featureColors: BinParams['featureColors'],
  faceGroups: readonly FaceGroupData[],
  triangleCount: number,
  vertices: Float32Array
): ThreeMFColorConfig | null {
  const grid = featureColors.lidLip;
  if (!grid) return null;
  const counts = { corners: grid.corners, bands: grid.bands };
  const getTriangle = (t: number): Float32Array => vertices.subarray(t * 9, t * 9 + 9);
  const triangleXYZ = (t: number) => {
    const v = getTriangle(t);
    return {
      x: (v[0] + v[3] + v[6]) / 3,
      y: (v[1] + v[4] + v[7]) / 3,
      z: (v[2] + v[5] + v[8]) / 3,
    };
  };
  const geom = computeLidLipGeom(faceGroups, getTriangle);
  if (!geom) return null;

  const { colors, colorToIndex } = resolveColorMapping(featureColors);
  const lidSlot = colorToIndex.get(normalizeHex(getZoneColor(featureColors, 'lid'))) ?? 0;
  const indices = new Array<number>(triangleCount).fill(lidSlot);

  for (const g of faceGroups) {
    if (g.tag !== FeatureTag.LID_LIP) continue;
    const start = g.start / 3;
    const end = Math.min(start + g.count / 3, triangleCount);
    for (let t = start; t < end; t++) {
      const { x, y, z } = triangleXYZ(t);
      const corner = classifyLipCorner(x, y, geom.cx, geom.cy);
      const band = classifyLipBand(z, geom.minZ, geom.maxZ, counts.bands);
      const zone = collapseLidLipCell(corner, band, counts);
      indices[t] = colorToIndex.get(normalizeHex(getZoneColor(featureColors, zone))) ?? lidSlot;
    }
  }
  return { materials: colors.map((c) => ({ color: c })), triangleMaterialIndices: indices };
}

/**
 * Convert a multi-piece combined export into a single 3MF Blob with named
 * objects. The first piece (bin) gets per-triangle multi-color material
 * indices; the lid and dividers ship with a uniform color slot drawn from
 * `featureColors.lid` / `featureColors.dividers` so a multi-color print
 * actually swaps filaments between body and lid/divider in the slicer.
 */
export function buildMultiObject3MF(
  pieces: CombinedExportResult['pieces'],
  faceGroups: CombinedExportResult['faceGroups'],
  params: BinParams,
  modelName: string,
  threeMFPrintSettings: ThreeMFPrintSettings,
  lidFaceGroups?: CombinedExportResult['lidFaceGroups']
): Blob {
  return export3MFMultiObject(
    buildMultiObject3MFObjects(pieces, faceGroups, params, lidFaceGroups),
    { name: modelName, printSettings: threeMFPrintSettings }
  );
}

/**
 * The coloured objects behind {@link buildMultiObject3MF}, before they are
 * sealed into a file. Exposed for the same reason as
 * {@link buildSinglePiece3MFObject}: a whole-layout PROJECT export packs these
 * onto build plates itself, and re-deriving the colour mapping there would
 * duplicate the zone/cutout logic that lives here.
 */
export function buildMultiObject3MFObjects(
  pieces: CombinedExportResult['pieces'],
  faceGroups: CombinedExportResult['faceGroups'],
  params: BinParams,
  lidFaceGroups?: CombinedExportResult['lidFaceGroups']
): ThreeMFObject[] {
  const objects: ThreeMFObject[] = [];
  const featureColorsEnabled: boolean = params.featureColors.enabled;
  // A colored cutout makes the design multi-color even with every featureColors
  // zone at body — mirror the single-piece path so bin+lid/divider exports paint
  // cutouts too.
  const multiColorEnabled: boolean =
    featureColorsEnabled || anyCutoutColored(params.cutouts) || anyCompartmentColored(params);
  let binBBox: FlatBBox | null = null;
  // Running right edge for side-laid-out pieces (lid, baseplate), so multiple
  // ancillary pieces form a row instead of stacking on the bin.
  let layoutCursorX: number | null = null;
  // Bin short-circuits to single-color when every active zone matches body;
  // ancillary pieces must stay in lockstep or `anyHasColors` in
  // `build3MFMultiObjectBuffer` would emit Bambu metadata for a file that
  // is functionally single-color.
  let binHasColorConfig = false;
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const parseResult = parseSTLBinary(piece.data);
    if (isErr(parseResult)) {
      throw new Error(getUserMessage(parseResult.error));
    }

    let { vertices, normals } = parseResult.value;
    if (i === 0) {
      binBBox = flatBBox(vertices);
      layoutCursorX = binBBox.maxX;
    } else if (isSideLaidOutPiece(piece.label) && binBBox !== null && layoutCursorX !== null) {
      const laid = layoutPieceRightOf(vertices, normals, binBBox, layoutCursorX);
      vertices = laid.vertices;
      normals = laid.normals;
      layoutCursorX = laid.nextCursorX;
    }

    let colorConfig: ThreeMFColorConfig | undefined;
    if (i === 0 && multiColorEnabled && faceGroups) {
      const triangleCount = vertices.length / 9;
      const mapping = buildTriangleMaterialIndices(
        faceGroups,
        params.featureColors,
        triangleCount,
        vertices,
        computeActiveZones(params),
        enumerateCutoutColorUnits(params.cutouts),
        // Compartment colours are classified by POSITION, so they are only
        // meaningful while the mesh is still in the bin's own frame. The
        // combined export always hands the whole bin over as `'bin'`; a split
        // piece is re-centred on itself (`splitBinBuilder` translates by
        // `-pieceCenter`), which would land every probe in the wrong cell. A
        // cutout tag rides the triangle and survives that, which is exactly why
        // it needs no such guard.
        piece.label === 'bin' ? planCompartmentColors(params) : null
      );
      if (mapping) {
        colorConfig = mapping.config;
        // Split lip grid → use the re-tessellated geometry so the bin object's
        // triangle count matches its per-triangle paint_color indices.
        if (mapping.vertices && mapping.normals) {
          vertices = mapping.vertices;
          normals = mapping.normals;
        }
      }
      binHasColorConfig = colorConfig !== undefined;
    } else if (i > 0 && multiColorEnabled && binHasColorConfig) {
      const zone = pieceZone(piece.label);
      if (zone !== null) {
        const triangleCount = vertices.length / 9;
        // The lid gets per-triangle paint when it has a lip grid AND the worker
        // sent its face groups; everything else (and a lid without either) stays
        // on the cheaper uniform slot.
        colorConfig =
          (zone === 'lid' && lidFaceGroups
            ? lidColorConfig(params.featureColors, lidFaceGroups, triangleCount, vertices)
            : null) ?? uniformColorConfig(zone, params.featureColors, triangleCount);
      }
    }

    objects.push({
      vertices,
      normals,
      name: formatPieceDisplayName(piece.label, params),
      colorConfig,
    });
  }

  return objects;
}

/**
 * Build a downloadable blob + filename for a combined-export result. STL
 * single-piece returns the raw STL; multi-piece returns a ZIP. STEP wraps
 * the single compound piece. 3MF is delegated to the dedicated builders.
 *
 * Pulled out of `useExport.ts` to keep that file under the 500-line cap.
 */
export function buildBinDownloadPayload(
  format: ExportFileFormat,
  result: CombinedExportResult,
  params: BinParams,
  fileName: string,
  threeMFContext: { modelName: string; threeMFPrintSettings: ThreeMFPrintSettings } | null
): { blob: Blob; downloadName: string } {
  if (format === '3mf') {
    if (!threeMFContext) throw new Error('3MF context required for 3MF export');
    if (result.pieces.length === 1) {
      const blob = buildSinglePiece3MF(
        result.pieces[0].data,
        result.faceGroups,
        params,
        threeMFContext.modelName,
        threeMFContext.threeMFPrintSettings,
        true
      );
      return { blob, downloadName: fileName };
    }
    const blob = buildMultiObject3MF(
      result.pieces,
      result.faceGroups,
      params,
      threeMFContext.modelName,
      threeMFContext.threeMFPrintSettings,
      result.lidFaceGroups
    );
    return { blob, downloadName: fileName };
  }

  if (format === 'step') {
    const blob = new Blob([result.pieces[0].data], { type: FORMAT_MIME_TYPES.step });
    return { blob, downloadName: fileName };
  }

  // STL
  if (result.pieces.length === 1) {
    const blob = new Blob([result.pieces[0].data], { type: FORMAT_MIME_TYPES.stl });
    return { blob, downloadName: fileName };
  }
  const baseName = fileName.replace(/\.stl$/, '');
  const zip = packagePiecesAsZip(
    result.pieces.map((p: { data: ArrayBuffer; label: string }) => ({
      data: p.data,
      label: p.label,
    })),
    baseName,
    '.stl'
  );
  return { blob: zip, downloadName: `${baseName}.zip` };
}

/**
 * Run a split-bin export through the worker pool when available, falling
 * back to the single bridge if the pool can't be acquired or fails. The
 * fallback path used to be a bare swallowed catch; errors now feed
 * `captureException` so pool regressions are visible in telemetry.
 *
 * The function is `async` and treated as one operation by `exportWithResilience`
 * — pool fallback happens inside a single attempt, not across attempts.
 */
export async function runSplitBinExport(
  params: BinParams,
  cutPlanesX: number[],
  cutPlanesY: number[],
  totalPieceCount: number,
  connectorConfig: SplitConnectorConfig,
  format: ExportFileFormat
): Promise<SplitExportResult> {
  // The worker writes STL or STEP; 3MF is packaged on the main thread from
  // STL pieces, so it rides the STL path.
  const workerFormat: ExportFormat = format === 'step' ? 'step' : 'stl';
  const options = { splitConnectorConfig: connectorConfig, format: workerFormat };
  let poolAcquired = false;
  try {
    const pool = await workerPoolManager.acquire();
    poolAcquired = true;
    if (pool.size > 1) {
      const result = await pool.exportSplitBin(
        params,
        cutPlanesX,
        cutPlanesY,
        totalPieceCount,
        options
      );
      workerPoolManager.release();
      poolAcquired = false;
      return result;
    }
    workerPoolManager.release();
    poolAcquired = false;
    const bridge = getActiveBridge();
    if (!bridge) throw new Error('Bridge not available');
    return await bridge.exportSplitBin(params, cutPlanesX, cutPlanesY, options);
  } catch (poolErr) {
    captureException(poolErr instanceof Error ? poolErr : new Error(String(poolErr)), {
      source: 'bin_export_pool_fallback',
      export_format: format,
    });
    if (poolAcquired) {
      workerPoolManager.release();
      poolAcquired = false;
    }
    const bridge = getActiveBridge();
    if (!bridge) throw new Error('Bridge not available', { cause: poolErr });
    return await bridge.exportSplitBin(params, cutPlanesX, cutPlanesY, options);
  } finally {
    if (poolAcquired) workerPoolManager.release();
  }
}

/**
 * Convert each piece of a split export (plus companion pieces) into a 3MF
 * blob. Returns ArrayBuffers paired with their labels so the caller can ZIP
 * them in one step. Multi-color is intentionally NOT propagated — split +
 * multi-color is a known gap.
 */
export async function buildSplit3MFPieces(
  pieces: ReadonlyArray<{ data: ArrayBuffer; label: string }>,
  baseName: string,
  threeMFPrintSettings: ThreeMFPrintSettings
): Promise<{ data: ArrayBuffer; label: string }[]> {
  const convertedPieces: { data: ArrayBuffer; label: string }[] = [];
  for (const piece of pieces) {
    const parseResult = parseSTLBinary(piece.data);
    if (isErr(parseResult)) {
      throw new Error(getUserMessage(parseResult.error));
    }
    const { vertices, normals } = parseResult.value;
    const blob = export3MF(vertices, normals, {
      name: `${baseName}_${piece.label}`,
      printSettings: threeMFPrintSettings,
    });
    convertedPieces.push({ data: await blob.arrayBuffer(), label: piece.label });
  }
  return convertedPieces;
}
