/**
 * Gridfinity bin generator orchestrator using brepjs (OpenCascade WASM).
 *
 * Composes the full generation pipeline from focused sub-modules:
 * - socketBuilder: per-cell segmented sockets (full 42mm + half 21mm cells)
 * - boxBuilder: rounded rect extruded + shelled (walls + floor) + stacking lip
 * - featureBuilder: dividers, inserts, cutouts, label tabs, scoop ramps
 * - shapeCache: memoization of expensive intermediate shapes
 * - generatorTypes: shared types, constants, and utilities
 *
 * Coordinate system:
 * - Z=0: bin floor level (where box meets socket)
 * - Socket: Z=-SOCKET_HEIGHT to Z=0
 * - Box body: Z=0 to Z=wallHeight
 * - Final mesh translated up by SOCKET_HEIGHT so Z=0 = absolute bottom
 */

import {
  drawRectangle,
  drawPolysides,
  unwrap,
  fuse,
  cut,
  cutAll,
  clone,
  translate,
  rotate,
  intersect,
  mesh,
  exportSTL,
  exportSTEP,
} from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData, ExportFormat } from '../../bridge/types';
import { GRIDFINITY } from '@/shared/constants/bin';

// Sub-module imports
import {
  SIZE,
  CLEARANCE,
  SOCKET_HEIGHT,
  LIP_SMALL_TAPER,
  LIP_HEIGHT,
  LIP_TAPER_WIDTH,
  checkCancelled,
  toIndexedMeshData,
  sketch,
} from './generatorTypes';
import type { ProgressFn, BooleanOpts } from './generatorTypes';
import { buildBaseSocket } from './socketBuilder';
import { buildBinBox, buildTopShape } from './boxBuilder';
import {
  buildCompartmentWalls,
  buildInsertCuts,
  buildCutoutCuts,
  buildLabelTabs,
  buildScoopRamps,
} from './featureBuilder';
import {
  getShellCache,
  setShellCache,
  getPatternTemplateCache,
  setPatternTemplateCache,
  getLastSolid,
  setLastSolid,
} from './shapeCache';
import { buildSlotCuts } from './slotBuilder';
import { getPatternDescriptors } from './wallPatterns';

// ─── Re-exports (public API) ─────────────────────────────────────────────────

export type { ProgressFn } from './generatorTypes';

/** Export result with binary data and suggested file name. */
export interface ExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
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

// ─── Export Functions ─────────────────────────────────────────────────────────

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

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Generate a complete Gridfinity bin from parameters.
 * Assembly order: base socket + box body + top shape (stacking lip)
 * Then features: dividers, inserts
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
  const wallThickness = params.wallThickness;
  const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;
  const isFlat = params.base.style === 'flat';
  const halfSockets = params.base.halfSockets && !isFlat;
  const solid = params.base.solid;
  // Wall extends from socket top to bin top. Per Gridfinity spec, base is 1u (7mm),
  // but the physical socket structure is 5mm deep. Wall = total - socket depth.
  // Flat floor: no socket, so the full height is available for the box body.
  // Half sockets: use socket height (sockets are socket-height structures).
  // Total height: e.g., 3u + lip = 21 + 4.4 = 25.4mm
  const wallHeight = isFlat ? totalHeight : totalHeight - SOCKET_HEIGHT;

  const outerW = params.width * SIZE - CLEARANCE;
  const outerD = params.depth * SIZE - CLEARANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const isSlotted = params.style === 'slotted';

  // Half sockets do not support magnet/screw holes (0.5x0.5 cells too small)
  const withMagnet =
    !isFlat &&
    !halfSockets &&
    (params.base.style === 'magnet' || params.base.style === 'magnet_and_screw');
  const withScrew =
    !isFlat &&
    !halfSockets &&
    (params.base.style === 'screw' || params.base.style === 'magnet_and_screw');

  // Dynamic quality: small bins (< 4x4) get higher fidelity preview
  const cellCount = params.width * params.depth;
  const isSmallBin = cellCount < 16; // 4x4 = 16 cells threshold
  const useHighQuality = forExport || isSmallBin;

  // Stages 1-3: Build base socket + box + lip, then assemble.
  // The assembled shell is cached -- only features (compartments, inserts, tabs)
  // need to rebuild when those params change.
  onProgress?.('base', 0.1);
  const shellKey = [
    params.width,
    params.depth,
    isFlat,
    halfSockets,
    withMagnet,
    withScrew,
    params.base.magnetDiameter,
    params.base.magnetDepth,
    params.base.screwDiameter,
    useHighQuality,
    wallHeight,
    wallThickness,
    params.base.stackingLip,
    solid,
  ].join('|');

  let bin: Shape3D;
  const cachedShell = getShellCache(shellKey);
  if (cachedShell) {
    bin = cachedShell;
  } else {
    checkCancelled(signal);
    onProgress?.('shell', 0.3);
    const cutoutTopOffset = solid ? params.cutoutConfig.topOffset : 0;
    const box = buildBinBox(
      params.width,
      params.depth,
      wallHeight,
      wallThickness,
      solid,
      cutoutTopOffset
    );

    if (isFlat) {
      // Flat floor: no socket, box body is the entire base
      checkCancelled(signal);
      onProgress?.('features', 0.4);
      if (params.base.stackingLip) {
        try {
          const top = translate(buildTopShape(params.width, params.depth, true), [
            0,
            0,
            wallHeight,
          ]);
          bin = unwrap(fuse(box, top, { optimisation: 'commonFace' }));
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') throw e;
          bin = box;
        }
      } else {
        bin = box;
      }
    } else {
      // Socket style: build base socket and fuse with box.
      // Half sockets mode subdivides each cell into 0.5x0.5 sub-sockets.
      const base = buildBaseSocket(
        params.width,
        params.depth,
        withMagnet,
        withScrew,
        params.base.magnetDiameter / 2,
        params.base.magnetDepth,
        params.base.screwDiameter / 2,
        useHighQuality,
        halfSockets
      );

      checkCancelled(signal);
      onProgress?.('features', 0.4);
      if (params.base.stackingLip) {
        try {
          const top = translate(buildTopShape(params.width, params.depth, true), [
            0,
            0,
            wallHeight,
          ]);
          bin = unwrap(
            fuse(unwrap(fuse(base, box, { optimisation: 'commonFace' })), top, {
              optimisation: 'commonFace',
            })
          );
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') throw e;
          bin = unwrap(fuse(base, box, { optimisation: 'commonFace' }));
        }
      } else {
        bin = unwrap(fuse(base, box, { optimisation: 'commonFace' }));
      }
    }

    setShellCache(shellKey, bin);
    bin = clone(bin);
  }

  // Stage 4: Features (dividers, inserts)
  // Features always rebuild because they apply boolean cuts to the assembly.
  // When only feature params changed, assembly is reused as starting point.
  checkCancelled(signal);
  onProgress?.('features', 0.5);

  // Solid mode: skip all interior features -- the bin is a solid block.
  // Cutouts will later carve into this solid to create shaped cavities.
  if (!solid) {
    // Interior features (dividers, tabs) must clear the stacking lip zone.
    // The lip's bottom taper extends LIP_SMALL_TAPER (0.7mm) inward from the
    // outer wall at wallHeight. Dividers and tabs stop short to avoid interference.
    const hasLip = params.base.stackingLip;
    const interiorHeight = hasLip ? wallHeight - LIP_SMALL_TAPER : wallHeight;

    if (!isSlotted) {
      checkCancelled(signal);
      const compartmentWalls = buildCompartmentWalls(params, innerW, innerD, interiorHeight);
      if (compartmentWalls) {
        try {
          bin = unwrap(fuse(bin, compartmentWalls));
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') throw e;
        }
      }
    }

    checkCancelled(signal);
    const insertCuts = buildInsertCuts(params);
    if (insertCuts) {
      try {
        bin = unwrap(cut(bin, insertCuts));
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e;
      }
    }

    if (isSlotted) {
      checkCancelled(signal);
      // Wall slots use interiorHeight (below lip taper zone).
      // Lip cutouts are wider rectangles that cut through the full lip profile
      // so dividers can slide in from the top.
      const lipInfo = hasLip
        ? { wallHeight, lipHeight: LIP_HEIGHT, lipTaperWidth: LIP_TAPER_WIDTH }
        : undefined;
      const slotCuts = buildSlotCuts(params, innerW, innerD, interiorHeight, lipInfo);
      if (slotCuts) {
        try {
          bin = unwrap(cut(bin, slotCuts));
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') throw e;
        }
      }
    }

    if (!isSlotted) {
      checkCancelled(signal);
      const labelTabs = buildLabelTabs(params, innerW, innerD, interiorHeight, wallThickness);
      if (labelTabs) {
        try {
          bin = unwrap(fuse(bin, labelTabs));
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') throw e;
        }
      }
    }

    // Finger scoops: concave ramp fused at front wall of compartments
    if (!isSlotted) {
      checkCancelled(signal);
      const scoopRamps = buildScoopRamps(params, innerW, innerD, wallHeight, wallThickness);
      if (scoopRamps) {
        try {
          bin = unwrap(fuse(bin, scoopRamps));
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') throw e;
        }
      }
    }

    // Wall patterns: Pattern cutouts -- optimized with template cloning + single cutAll.
    //
    // Performance strategy:
    // 1. Pattern calculators adapt size based on bin height (fewer cuts for large bins)
    // 2. Build ONE shape template, clone() for each center position
    // 3. Single cutAll() groups tools via TopoDS_Compound + one BRepAlgoAPI_Cut
    // 4. Preview skips SimplifyResult (shape is immediately meshed and discarded)
    // 5. Cache the shape template between generations
    // Runtime guard: wallPattern may be missing from old saved data
    if (params.wallPattern.enabled) {
      const patternResult = getPatternDescriptors(params, innerW, innerD, interiorHeight);
      if (patternResult) {
        const { descriptors: wallDescriptors, calculator } = patternResult;
        try {
          const cutDepth = params.wallThickness * 4;
          const halfDepth = cutDepth / 2;
          const patternType = calculator.getPatternType();
          const shapeRadius = calculator.getShapeRadius();

          // Build or reuse cached shape template
          const templateKey = `${patternType}|${shapeRadius}|${cutDepth}`;
          let shapeTemplate: Shape3D;

          const cachedTemplate = getPatternTemplateCache(templateKey);
          if (cachedTemplate) {
            shapeTemplate = cachedTemplate;
          } else {
            // Create polygonal shape based on pattern type (honeycomb = 6 sides)
            const sides = calculator.getSidesCount();
            shapeTemplate = sketch(drawPolysides(shapeRadius, sides), 'XY').extrude(cutDepth);
            setPatternTemplateCache(templateKey, shapeTemplate);
          }

          const allPatternTools: Shape3D[] = [];

          for (const wall of wallDescriptors) {
            for (const center of wall.centers) {
              let shape: Shape3D = clone(shapeTemplate);
              shape = translate(shape, [center.x, center.y, -halfDepth]);
              shape = rotate(shape, 90, { at: [0, 0, 0], axis: [1, 0, 0] });
              if (wall.zRotation !== undefined) {
                shape = rotate(shape, wall.zRotation, { at: [0, 0, 0], axis: [0, 0, 1] });
              }
              shape = translate(shape, [wall.translateX, wall.translateY, wall.translateZ]);
              allPatternTools.push(shape);
            }
          }

          if (allPatternTools.length > 0) {
            checkCancelled(signal);
            // Preview: skip SimplifyResult -- shape is meshed and discarded
            bin = unwrap(
              cutAll(bin, allPatternTools, { simplify: forExport, signal } as BooleanOpts)
            );
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') throw e;
        }
      }
    }
  } else {
    // Solid mode: apply cutouts (top-down cavity cuts into the solid block)
    const cutoutCuts = buildCutoutCuts(params, innerW, innerD, wallHeight);
    if (cutoutCuts) {
      try {
        bin = unwrap(cut(bin, cutoutCuts));
      } catch {
        // Cut operation can fail on complex geometries; skip if it does
      }
    }
  }

  // Stage 5: Translate so Z=0 = absolute bottom (socket bottom).
  // Flat floor bins are already at Z=0 -- no translation needed.
  checkCancelled(signal);
  onProgress?.('merge', 0.8);
  if (!isFlat) {
    bin = translate(bin, [0, 0, SOCKET_HEIGHT]);
  }

  // Stage 6: Tessellate to triangle mesh
  checkCancelled(signal);
  onProgress?.('merge', 0.9);
  setLastSolid(bin);

  // Dynamic tessellation: export gets fine quality, preview adapts to bin size
  const maxDimension = Math.max(params.width, params.depth) * SIZE;
  let tolerance: number;
  let angularTolerance: number;

  if (forExport) {
    // Export: fine tessellation for smooth curves
    tolerance = 0.01;
    angularTolerance = 5;
  } else if (isSmallBin) {
    // Small bin preview: moderate quality (fast but still smooth)
    tolerance = Math.min(0.5, Math.max(0.2, maxDimension / 500));
    angularTolerance = 15;
  } else {
    // Large bin preview: coarse tessellation for speed
    tolerance = Math.min(3, Math.max(1, maxDimension / 100));
    angularTolerance = 30;
  }

  const shapeMesh = mesh(bin, { tolerance, angularTolerance });

  onProgress?.('merge', 1.0);
  // Skip normals for large bin preview (GPU flat shading is faster)
  return toIndexedMeshData(shapeMesh, !useHighQuality);
}

// ─── Split Export ────────────────────────────────────────────────────────────

/**
 * Export the cached (or regenerated) bin solid, split into pieces via boolean cuts.
 *
 * For each rectangular region defined by the cut planes, the full solid is cloned
 * and intersected with a bounding box to extract just that piece. Each piece is
 * independently tessellated to STL.
 *
 * @param params Bin parameters (used to regenerate if no cached solid)
 * @param cutPlanesX Sorted X-axis cut plane positions in mm, relative to bin center
 * @param cutPlanesY Sorted Y-axis cut plane positions in mm, relative to bin center
 * @param tolerance STL tessellation tolerance (default 0.01)
 * @param angularTolerance STL angular tolerance in degrees (default 5)
 */
export async function exportSplitBin(
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  tolerance = 0.01,
  angularTolerance = 5
): Promise<SplitExportResult> {
  // Ensure we have a solid to work with
  if (!getLastSolid()) {
    generateBin(params, undefined, true);
  }

  const solid = getLastSolid();
  if (!solid) {
    throw new Error('Failed to generate solid for split export');
  }

  const outerW = params.width * SIZE - CLEARANCE;
  const outerD = params.depth * SIZE - CLEARANCE;

  // Build sorted boundary arrays: [left edge, ...cut planes, right edge]
  const xBounds = [-outerW / 2, ...cutPlanesX, outerW / 2];
  const yBounds = [-outerD / 2, ...cutPlanesY, outerD / 2];

  // Large box height for cutting (much taller than any bin)
  const boxH = 500;

  const pieces: SplitExportResult['pieces'] = [];

  // Process each piece region sequentially to limit memory
  for (let col = 0; col < xBounds.length - 1; col++) {
    for (let row = 0; row < yBounds.length - 1; row++) {
      const xMin = xBounds[col];
      const xMax = xBounds[col + 1];
      const yMin = yBounds[row];
      const yMax = yBounds[row + 1];

      // Create a bounding box for this piece's region
      const pieceW = xMax - xMin;
      const pieceD = yMax - yMin;
      const centerX = (xMin + xMax) / 2;
      const centerY = (yMin + yMax) / 2;

      const cuttingBox = sketch(drawRectangle(pieceW, pieceD), 'XY', -boxH / 2).extrude(boxH);
      const translatedBox = translate(cuttingBox, [centerX, centerY, 0]);

      // Intersect the full solid with this box to get just this piece
      const piece = unwrap(intersect(clone(solid), translatedBox));

      // Tessellate to binary STL
      const blob = unwrap(
        exportSTL(piece, {
          tolerance,
          angularTolerance,
          binary: true,
        })
      );
      const data = await blob.arrayBuffer();

      const label = `piece-${col + 1}x${row + 1}`;
      pieces.push({ data, label, col: col + 1, row: row + 1 });
    }
  }

  return { pieces };
}
