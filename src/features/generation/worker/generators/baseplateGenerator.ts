/**
 * Baseplate geometry generation for Gridfinity baseplates.
 *
 * Builds a baseplate as a solid slab with pockets cut from the top surface.
 * Each pocket receives a bin's tapered socket profile. The pocket shape is
 * the bin socket profile at full grid size (no clearance reduction), so that
 * bin sockets (which are reduced by CLEARANCE) fit with the intended gap.
 *
 * Without magnets: slab height = SOCKET_HEIGHT (5mm). Pockets are through-cut.
 *
 * With magnets (matching Gridfinity spec): slab height = SOCKET_HEIGHT +
 * MAGNET_FLOOR + magnetDepth. Pockets cut to SOCKET_HEIGHT depth only,
 * leaving a solid continuous floor under each pocket. Magnet holes are blind
 * cylindrical pockets cut downward from the pocket floor into this solid
 * floor, leaving a thin retaining floor (MAGNET_FLOOR = 0.5mm) at the
 * bottom. Magnets are dropped in from the pocket side and held by gravity.
 *
 * Coordinate system (after final Z-shift):
 * - Z=0: bottom face of baseplate (solid)
 * - Z=totalHeight: top face (bin interface), pockets open here
 * - Magnet holes open at Z=floorDepth (pocket floor) down to Z=MAGNET_FLOOR
 *
 * The orchestrator here ties together pure-geometry helpers from sibling
 * modules: pockets, magnets, connectors, edges, slab, batch ops, STL, and the
 * shared LRU caches.
 */

import {
  unwrap,
  intersect,
  clone,
  translate,
  fuseAll,
  cutAll,
  mesh,
  meshEdges,
  getKernelCapabilities,
  exportSTEP,
  booleanPipeline,
  isOk,
  drawRectangle,
} from 'brepjs';
import type { Shape3D, ValidSolid, BooleanPipelineStep } from 'brepjs';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import type { MeshData, ExportFormat, ConnectorKeyMeshData } from '../../bridge/types';
import {
  SOCKET_HEIGHT,
  forEachCell,
  frameCells,
  toIndexedMeshData,
  checkCancelled,
  MAGNET_FLOOR,
  MIN_PRINTABLE_TILE_MM,
  resolveCornerRadii,
} from './generatorTypes';
import type { ProgressFn, CellInfo, SideMargins } from './generatorTypes';
import {
  buildLightweightFloorCutters,
  buildPartialCellFloorCutters,
} from './lightweightFloorCutter';
import { meshResultCache, slabWithPocketsCache } from './baseplateCaches';
import { meshCacheKey, slabPocketsCacheKey } from './baseplateCacheKeys';
import { sanitizeParams, tagOp, buildSlabProfile } from './baseplateSlab';
import { cutInBatches } from './baseplateBatchOps';
import { getPocketTemplate } from './baseplatePockets';
import { buildMagnetHoles, buildPartialCellMagnetHoles } from './baseplateMagnets';
import {
  buildConnectors,
  buildDovetailKey,
  buildSnapClip,
  buildSnapClipForPrint,
} from './baseplateConnectors';
import { snapClipLevels } from '@/shared/constants/connectors';
import { creaseEdges } from './utils';
import { buildBaseplateSTL } from './baseplateSTL';
import { EDGE_ANGULAR_TOLERANCE_RAD } from '@/shared/constants/tessellation';

export {
  clearBaseplateCaches,
  getBaseplateCacheStats,
  resetBaseplateCacheStats,
} from './baseplateCaches';

/**
 * Diagnostic probe invoked at each baseplate construction milestone.
 *
 * Test-only. `shape` is a *borrowed* handle valid only for the synchronous
 * duration of the call — do not retain, delete, or mutate it. Later build
 * steps may dispose the underlying WASM object, making any retained reference
 * a use-after-free.
 */
export type BaseplateProbe = (label: string, shape: Shape3D) => void;

/**
 * Generate baseplate mesh for the live preview.
 *
 * `draft` builds a faster draft-quality solid (skips the underside lightweight
 * floor cutters). The standalone-page preview passes `true`; the printed export
 * goes through `exportBaseplate`, which always builds full geometry.
 */
export function generateBaseplate(
  rawParams: ResolvedBaseplateParams,
  onProgress: ProgressFn,
  forExport: boolean,
  signal?: AbortSignal,
  draft: boolean = false
): MeshData {
  const params = sanitizeParams(rawParams);
  onProgress('base', 0);
  checkCancelled(signal);

  // Mesh cache short-circuits BREP booleans + tessellation entirely
  const cacheKey = meshCacheKey(params, forExport, draft);
  const cached = meshResultCache.get(cacheKey);
  if (cached !== undefined) {
    onProgress('base', 1);
    return cached;
  }

  const baseplate = buildBaseplateSolid(
    params,
    forExport,
    (progress) => {
      onProgress('base', progress);
      checkCancelled(signal);
    },
    undefined,
    draft
  );

  onProgress('base', 0.9);
  checkCancelled(signal);

  // Tessellation tolerances: match the bin designer's tier strategy. Magnet
  // hole cylinders need tight angular tolerance; flat surfaces tolerate
  // coarser linear tolerance.
  const totalW = params.width * params.gridUnitMm + params.paddingLeft + params.paddingRight;
  const totalD = params.depth * params.gridUnitMm + params.paddingFront + params.paddingBack;
  const maxDimension = Math.max(totalW, totalD);
  let tolerance: number;
  let angularTolerance: number;

  if (forExport) {
    tolerance = 0.01;
    angularTolerance = 5;
  } else if (params.magnetHoles) {
    tolerance = Math.min(0.1, Math.max(0.05, maxDimension / 2500));
    angularTolerance = 10;
  } else {
    tolerance = Math.min(0.4, Math.max(0.15, maxDimension / 600));
    angularTolerance = 12;
  }

  try {
    const meshResult = mesh(baseplate, { tolerance, angularTolerance });
    // Edge extraction mirrors tessellateStage.ts: analytic B-rep edges on
    // extract-time kernels, dihedral creases on build-time (manifold) kernels.
    const edgeVerts: ArrayLike<number> =
      getKernelCapabilities().tessellationModel === 'build-time'
        ? creaseEdges(meshResult)
        : meshEdges(baseplate, { tolerance, angularTolerance: EDGE_ANGULAR_TOLERANCE_RAD }).lines;

    onProgress('base', 1);

    const baseMesh = toIndexedMeshData(meshResult, edgeVerts);
    // Attach the exact seated snap-clip so the preview renders the real
    // socket-relieved part instead of a procedural approximation. Same for every
    // junction, so the main thread reuses one copy across all seats.
    const connectorKeyMesh = buildConnectorKeyMeshIfNeeded(params);
    const result = connectorKeyMesh ? { ...baseMesh, connectorKeyMesh } : baseMesh;
    meshResultCache.set(cacheKey, result);
    return result;
  } finally {
    baseplate.delete();
  }
}

/**
 * Mesh the seated snap-clip connector when this baseplate uses one on a join
 * edge. Returns undefined for every other style/edge so the field stays absent.
 * The clip is the same regardless of which piece carries it; the main thread
 * keeps one copy and seats it at each junction.
 */
function buildConnectorKeyMeshIfNeeded(
  params: ResolvedBaseplateParams
): ConnectorKeyMeshData | undefined {
  if (!params.connectorNubs || params.connectorStyle !== 'snapClip') return undefined;
  const hasJoinEdge = params.edges ? Object.values(params.edges).some((e) => e === 'join') : false;
  if (!hasJoinEdge) return undefined;

  const totalHeight = SOCKET_HEIGHT + (params.magnetHoles ? MAGNET_FLOOR + params.magnetDepth : 0);
  if (!snapClipLevels(totalHeight, params.connectorFitOffset ?? 0, params.nozzleSizeMm).viable)
    return undefined;

  const clip = buildSnapClip(totalHeight, params.gridUnitMm, params.nozzleSizeMm);
  try {
    const clipMesh = mesh(clip, { tolerance: 0.05, angularTolerance: 10 });
    const indexed = toIndexedMeshData(clipMesh, new Float32Array(0));
    return {
      vertices: indexed.vertices,
      normals: indexed.normals,
      indices: indexed.indices,
      triangleCount: indexed.triangleCount,
    };
  } finally {
    clip.delete();
  }
}

/** Build the complete baseplate BREP solid. */
export function buildBaseplateSolid(
  params: ResolvedBaseplateParams,
  forExport: boolean = true,
  onProgress?: (progress: number) => void,
  probe?: BaseplateProbe,
  draft: boolean = false
): Shape3D {
  const {
    width,
    depth,
    gridUnitMm,
    magnetHoles,
    magnetDiameter,
    magnetDepth,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack,
    fractionalEdgeX,
    fractionalEdgeY,
    edges,
    overTile,
    overTileHalfGrid,
    overTileHalfGridSolidLeftover,
  } = params;

  const floorDepth = magnetHoles ? MAGNET_FLOOR + magnetDepth : 0;
  const totalW = width * gridUnitMm + paddingLeft + paddingRight;
  const totalD = depth * gridUnitMm + paddingFront + paddingBack;
  const totalHeight = SOCKET_HEIGHT + floorDepth;
  const slabOffsetX = (paddingRight - paddingLeft) / 2;
  const slabOffsetY = (paddingBack - paddingFront) / 2;
  const cellOpts = { fractionalEdgeX, fractionalEdgeY, gridUnitMm };

  // Over-tile margin tiles (clipped padding tiles) are decomposed ONCE here and
  // reused everywhere they must agree: the pocket cuts (cache-miss branch below)
  // and the magnet holes + lightweight floor cutters further down. A second
  // frameCells() call risked silent drift — e.g. omitting overTileHalfGridSolidLeftover
  // would place magnets/floor cutters on cells that were never pocketed.
  const overTileMargins: SideMargins = {
    left: paddingLeft,
    right: paddingRight,
    front: paddingFront,
    back: paddingBack,
  };
  const overTileFrame: CellInfo[] = overTile
    ? frameCells(
        width,
        depth,
        overTileMargins,
        gridUnitMm,
        MIN_PRINTABLE_TILE_MM,
        overTileHalfGrid,
        overTileHalfGridSolidLeftover
      )
    : [];

  // Cached separately so that toggling magnets or connectors doesn't redo the
  // pocket boolean cuts.
  const spKey = slabPocketsCacheKey(params, forExport);
  const cachedSlab = slabWithPocketsCache.get(spKey);
  let baseplate: Shape3D;

  if (cachedSlab !== undefined) {
    baseplate = unwrap(clone(cachedSlab));
    onProgress?.(0.5);
  } else {
    // Build solid slab with RECTANGULAR profile for caching — pocket cuts are
    // independent of corner radius, so we cache the rectangular slab+pockets
    // and apply corner rounding as a post-cache step. Avoids expensive pocket
    // re-cuts when only corner radius changes.
    const rectProfile = drawRectangle(totalW, totalD);
    const extrudedSlab = (
      rectProfile.sketchOnPlane('XY', 0) as { extrude: (h: number) => Shape3D }
    ).extrude(-totalHeight);
    baseplate = translate(extrudedSlab, [slabOffsetX, slabOffsetY, 0]);
    extrudedSlab.delete();
    probe?.('slabExtruded', baseplate);

    onProgress?.(0.2);

    // Cut pockets — through-cut when no magnets, partial when magnets leave a floor
    const throughCut = !magnetHoles;
    const pockets: Shape3D[] = [];
    const addPocket = (cell: CellInfo): void => {
      const cellW_mm = cell.widthUnits * gridUnitMm;
      const cellD_mm = cell.depthUnits * gridUnitMm;
      const pocket = getPocketTemplate(cellW_mm, cellD_mm, forExport, throughCut);
      // pocket from getPocketTemplate is a clone owned by caller — translate
      // produces a new shape, so dispose the pre-translation clone.
      const positioned = translate(pocket, [cell.centerX, cell.centerY, 0]);
      pocket.delete();
      pockets.push(positioned);
    };
    forEachCell(width, depth, addPocket, cellOpts);

    // Over-tile: fill the drawer-fit padding margins with grid-aligned clipped
    // pockets (per-side; a margin below the printable threshold stays solid
    // padding). Additive — the slab, full pockets, magnets, and offset are
    // unchanged, so this composes cleanly with split pieces. Uses the shared
    // overTileFrame so the magnets/floor cutters below cut exactly these cells.
    for (const cell of overTileFrame) {
      addPocket(cell);
    }

    if (pockets.length > 0) {
      baseplate = cutInBatches(baseplate, pockets);
    }

    slabWithPocketsCache.set(spKey, baseplate);
    // Clone after caching so subsequent mutations don't corrupt the cached solid
    baseplate = unwrap(clone(baseplate));
    onProgress?.(0.5);
  }
  probe?.('pocketsCut', baseplate);

  // Apply corner rounding as a post-cache step — this is fast (single boolean
  // cut) and avoids redoing expensive pocket cuts when corner radius changes.
  //
  // Max radius: half a grid unit + padding. The arc can enter the corner cell
  // but won't reach past the cell center, preserving the pocket structure.
  // Also clamped to half the slab to prevent degenerate geometry.
  const minPadding = Math.min(
    Math.min(paddingLeft, paddingRight),
    Math.min(paddingFront, paddingBack)
  );
  const cellLimit = gridUnitMm / 2 + minPadding;
  const geomLimit = Math.min(totalW, totalD) / 2 - 0.1;
  const maxRadius = Math.min(cellLimit, geomLimit);
  const cornerRadii = resolveCornerRadii(params, maxRadius);
  const hasRounding =
    cornerRadii.tl > 0 || cornerRadii.tr > 0 || cornerRadii.bl > 0 || cornerRadii.br > 0;
  if (hasRounding) {
    const roundedProfile = buildSlabProfile(totalW, totalD, cornerRadii, edges);
    const roundedSlab = (
      roundedProfile.sketchOnPlane('XY', 0) as { extrude: (h: number) => Shape3D }
    ).extrude(-totalHeight);
    const roundedTranslated = translate(roundedSlab, [slabOffsetX, slabOffsetY, 0]);
    roundedSlab.delete();
    // Intersect: keep only material that's inside both the cached rectangular
    // slab-with-pockets AND the rounded profile.
    const oldBaseplate = baseplate;
    baseplate = tagOp('cornerClipIntersect', () => unwrap(intersect(baseplate, roundedTranslated)));
    oldBaseplate.delete();
    roundedTranslated.delete();
    probe?.('cornerIntersected', baseplate);
  }

  // Magnet hole cutters — built and cut in batches to limit WASM memory.
  // A 16x16 grid produces 1024 magnet holes; holding all simultaneously can OOM.
  if (magnetHoles) {
    const holes = buildMagnetHoles(width, depth, magnetDiameter / 2, magnetDepth, cellOpts);
    // Over-tile margin tiles get magnets too — the corner magnets that fit, or a
    // spread/centered magnet for tiles too small for any corner — so the clipped
    // padding tiles aren't left as solid plastic. Mirrors the pocket frame above.
    if (overTileFrame.length > 0) {
      holes.push(
        ...buildPartialCellMagnetHoles(overTileFrame, magnetDiameter / 2, magnetDepth, gridUnitMm)
      );
    }
    baseplate = cutInBatches(baseplate, holes);
    probe?.('magnetHolesCut', baseplate);
  }

  // Lightweight floor cutters (cross-shaped material removal on the underside).
  // Run for both the live preview and the export so they match; only the
  // explicit `draft` fast-path skips them (they're ~⅓ of build time on magnet
  // grids and invisible from above). Over-tile margin tiles get their own
  // partial-cell hollowing so the clipped padding tiles aren't left solid.
  if (!draft && magnetHoles && params.lightweight !== false) {
    const floorCutters = buildLightweightFloorCutters(
      width,
      depth,
      magnetDiameter / 2,
      magnetDepth,
      cellOpts
    );
    if (overTileFrame.length > 0) {
      floorCutters.push(
        ...buildPartialCellFloorCutters(
          overTileFrame,
          magnetDiameter / 2,
          magnetDepth,
          gridUnitMm,
          params.lightweight
        )
      );
    }
    baseplate = cutInBatches(baseplate, floorCutters);
    probe?.('lightweightFloorCut', baseplate);
  }

  onProgress?.(0.4);

  // Connector groove cutters (small count — no batching needed)
  const { nubs, holes: connHoles } = buildConnectors(
    params,
    totalHeight,
    totalW,
    totalD,
    slabOffsetX,
    slabOffsetY,
    forExport
  );

  if (nubs.length > 0 || connHoles.length > 0) {
    const steps: BooleanPipelineStep[] = [
      ...nubs.map((n): BooleanPipelineStep => ({ op: 'fuse', tool: n })),
      ...connHoles.map((c): BooleanPipelineStep => ({ op: 'cut', tool: c })),
    ];
    const preBoolean = baseplate;
    const pipelineResult = booleanPipeline(baseplate, steps);
    let pipelineLabel = 'connectorPipeline';
    if (isOk(pipelineResult)) {
      baseplate = pipelineResult.value;
    } else {
      // Fallback: sequential fuseAll then cutAll. Tag the probe so the
      // diagnostic can tell which path produced the final solid (#1494).
      pipelineLabel = 'connectorPipelineFallback';
      if (nubs.length > 0) {
        baseplate = tagOp('connectorFuse', () =>
          unwrap(fuseAll([baseplate, ...nubs] as ValidSolid[]))
        );
      }
      if (connHoles.length > 0) {
        const preCut = baseplate;
        baseplate = tagOp('connectorCut', () =>
          unwrap(cutAll(baseplate as ValidSolid, connHoles as ValidSolid[]))
        );
        if (preCut !== preBoolean) preCut.delete();
      }
    }
    if (baseplate !== preBoolean) preBoolean.delete();
    for (const n of nubs) n.delete();
    for (const c of connHoles) c.delete();
    probe?.(pipelineLabel, baseplate);
  }

  onProgress?.(0.6);
  onProgress?.(0.8);

  // Probe before the final translate: the +Z shift preserves topology,
  // orientation, and signed volume, so the diagnostic sees identical
  // metrics either way — and a probe throw here can't strand `baseplate`
  // (already in scope, freed after `translate` returns) or `finalBaseplate`
  // (not yet created).
  probe?.('final', baseplate);
  const finalBaseplate = translate(baseplate, [0, 0, totalHeight]);
  baseplate.delete();
  return finalBaseplate;
}

/** Export baseplate as STL or STEP file. */
export async function exportBaseplate(
  rawParams: ResolvedBaseplateParams,
  format: ExportFormat,
  tolerance?: number,
  angularTolerance?: number
): Promise<{ data: ArrayBuffer; fileName: string }> {
  const params = sanitizeParams(rawParams);
  // Use simplified pocket cutter (forExport=false) — the full-detail
  // multi-section loft creates BREP topologies that OCCT can't reliably
  // tessellate or export. Geometrically equivalent for 3D printing.
  const baseplate = buildBaseplateSolid(params, false);
  try {
    const totalW = params.width * params.gridUnitMm + params.paddingLeft + params.paddingRight;
    const totalD = params.depth * params.gridUnitMm + params.paddingFront + params.paddingBack;
    const name = `baseplate_${params.width}x${params.depth}_${Math.round(totalW)}x${Math.round(totalD)}mm`;

    if (format === 'step') {
      const blob = unwrap(exportSTEP(baseplate));
      const data = await blob.arrayBuffer();
      return { data, fileName: `${name}.step` };
    }

    // STL: tessellate via brepjs `mesh()` and pack triangles into a binary
    // STL ourselves — OCCT's StlAPI.Write fails on baseplate geometries.
    // brepjs already produces face-consistent winding so no per-triangle
    // correction is applied (see #1472).
    //
    // Default linear tolerance is 0.02mm — an order of magnitude below any FDM
    // nozzle/layer resolution (~0.1-0.4mm), so it's visually and functionally
    // indistinguishable from the prior 0.01mm while roughly halving the
    // tessellation triangle budget on large plates. Callers can still override.
    const tol = tolerance ?? 0.02;
    const angTol = angularTolerance ?? 6;
    const meshResult = mesh(baseplate, { tolerance: tol, angularTolerance: angTol });
    const data = buildBaseplateSTL(meshResult, name);
    return { data, fileName: `${name}.stl` };
  } finally {
    baseplate.delete();
  }
}

/**
 * Export the standalone dovetail key (one identical part hammered into
 * every seam junction). Height matches the plate so the seated key is flush.
 */
export async function exportConnectorKey(
  rawParams: ResolvedBaseplateParams,
  format: ExportFormat,
  tolerance?: number,
  angularTolerance?: number
): Promise<{ data: ArrayBuffer; fileName: string }> {
  const params = sanitizeParams(rawParams);
  const floorDepth = params.magnetHoles ? MAGNET_FLOOR + params.magnetDepth : 0;
  const totalHeight = SOCKET_HEIGHT + floorDepth;
  // Snap clip ships its own bed-flat part; dovetail key is the legacy default.
  const key =
    params.connectorStyle === 'snapClip'
      ? buildSnapClipForPrint(totalHeight, params.gridUnitMm, params.nozzleSizeMm)
      : buildDovetailKey(totalHeight);
  try {
    const name = 'connector_key';
    if (format === 'step') {
      const blob = unwrap(exportSTEP(key));
      const data = await blob.arrayBuffer();
      return { data, fileName: `${name}.step` };
    }
    const tol = tolerance ?? 0.01;
    const angTol = angularTolerance ?? 5;
    const meshResult = mesh(key, { tolerance: tol, angularTolerance: angTol });
    const data = buildBaseplateSTL(meshResult, name);
    return { data, fileName: `${name}.stl` };
  } finally {
    key.delete();
  }
}
