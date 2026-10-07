/**
 * Outline fit test: a thin ring around every opening, its inner edge the bin's
 * own pocket wall.
 *
 * Traced rather than rebuilt from the cutout list. The bin is generated and
 * sliced just under its fill surface, then compared with the same body
 * generated without cutouts: whatever the cutouts removed is the pocket
 * footprint. Groups, arrays, rotation, paths, mesh imprints and open sides all
 * arrive through that one difference, and anything else that marks the top of
 * the bin (wall text, label slots) is in both slices and cancels.
 *
 * The rings are offset, clipped and extruded in Manifold's 2D domain, so no
 * BREP solid exists to write a STEP file from.
 */

import { withScope } from 'brepjs';
import type { DisposalScope } from 'brepjs';
import type { CrossSection, ManifoldToplevel } from 'manifold-3d';
import type { BinParams } from '@/shared/types/bin';
import type { BedSize } from '@/shared/utils/fitTestPlan';
import {
  fitTestOutlineSource,
  planFitTestOutlineSplit,
  resolveFitTestOutlineSize,
} from '@/shared/utils/fitTestOutlinePlan';
import type { FitTestOutlineSize } from '@/shared/utils/fitTestOutlinePlan';
import { getSplitPlanePositionsMm } from '@/shared/utils/splitPositions';
import type { ExportFormat } from '../../bridge/types';
import { buildSTLBufferFromIndexed } from '../../export/stlExporter';
import { getLoadedManifoldModule, getManifoldModule } from '../manifoldRuntime';
import { generateBin } from './binOrchestrator';
import { getLastSolid } from './shapeCache';
import { hasMeshImprints, prepareMeshImprints } from './meshImprint';
import { computeCreaseNormals } from './meshImprintNormals';
import { cutFitTestBand, fitTestBandTopZ, pieceToMesh } from './fitTestSlice';
import type { FitTestExportResult, FitTestMeshPiece } from './fitTestSlice';

/** How far under the fill surface the pocket wall is traced (mm): below the top
 *  face, which the band shares with the bin, and above any real pocket floor. */
const TRACE_DEPTH_MM = 0.1;
/** Band tessellated to take the trace from (mm). */
const TRACE_BAND_MM = 0.5;
/** Width under which a pocket region is tessellation noise rather than a pocket
 *  (mm): the two bodies are meshed separately, so their shared outer wall can
 *  disagree by a chord. */
const SLIVER_MM = 0.1;
/** Segments per full turn on a ring's rounded outer corners: under 0.01mm of
 *  chord error at the widest ring, where the default quality leaves visible
 *  facets on a 1mm radius. */
const CORNER_SEGMENTS = 64;
/** Islands smaller than this (mm²) cannot print and are dropped. */
const MIN_ISLAND_MM2 = 0.05;
/** Reach of a split window's outer edges past anything it can hold (mm). */
const WINDOW_REACH_MM = 1e4;

export const FIT_TEST_OUTLINE_BASE_NAME = 'fit-test-outline';

export interface FitTestOutlineOptions {
  readonly size?: Partial<FitTestOutlineSize>;
  /** Print bed (mm). An outline that overflows it is split like the card. */
  readonly bed?: BedSize;
}

function loadedModule(): ManifoldToplevel {
  const module = getLoadedManifoldModule();
  if (!module) throw new Error('The outline fit test needs the mesh engine, which is not loaded');
  return module;
}

/** The body's material in a plane just under its fill surface. */
function traceMaterial(
  scope: DisposalScope,
  module: ManifoldToplevel,
  params: BinParams,
  topZ: number
): CrossSection {
  generateBin(params, undefined, true);
  const solid = getLastSolid();
  if (!solid) throw new Error('Failed to generate solid for the outline fit test');

  const band = cutFitTestBand(scope, solid, topZ, TRACE_BAND_MM);
  const m = pieceToMesh({ solid: band, label: '' }, params, hasMeshImprints(params));
  const input = new module.Mesh({ numProp: 3, vertProperties: m.vertices, triVerts: m.indices });
  input.merge();
  const manifold = new module.Manifold(input);
  try {
    return manifold.slice(topZ - TRACE_DEPTH_MM);
  } finally {
    manifold.delete();
  }
}

/** Run `build` with every CrossSection it registers freed afterwards. */
function withSections<T>(build: (keep: (s: CrossSection) => CrossSection) => T): T {
  const owned: CrossSection[] = [];
  try {
    return build((s) => {
      owned.push(s);
      return s;
    });
  } finally {
    for (const s of owned) s.delete();
  }
}

/** The rings as one 2D region. The caller owns the result. */
function traceRings(params: BinParams, wallMm: number): CrossSection {
  const module = loadedModule();
  const source = fitTestOutlineSource(params);
  const topZ = fitTestBandTopZ(source);

  return withScope((scope: DisposalScope) =>
    withSections((keep) => {
      const material = keep(traceMaterial(scope, module, source, topZ));
      const body = keep(traceMaterial(scope, module, { ...source, cutouts: [] }, topZ));
      const removed = keep(body.subtract(material));
      const pockets = keep(
        keep(removed.offset(-SLIVER_MM / 2, 'Miter')).offset(SLIVER_MM / 2, 'Miter')
      );
      // Intersected with the material rather than differenced from the pockets:
      // the inner edge is then the pocket wall exactly as the bin cut it, and a
      // ring stops at the board edge and never crosses into a neighbour.
      const rings = keep(
        keep(pockets.offset(wallMm, 'Round', 2, CORNER_SEGMENTS)).intersect(material)
      );
      const islands = rings.decompose();
      try {
        return module.CrossSection.compose(islands.filter((i) => i.area() >= MIN_ISLAND_MM2));
      } finally {
        for (const island of islands) island.delete();
      }
    })
  );
}

function extrudeToMesh(region: CrossSection, heightMm: number, label: string): FitTestMeshPiece {
  const solid = region.extrude(heightMm);
  try {
    const out = solid.getMesh();
    const shaded = computeCreaseNormals(out.vertProperties, out.triVerts);
    return { vertices: shaded.positions, normals: shaded.normals, indices: shaded.indices, label };
  } finally {
    solid.delete();
  }
}

/**
 * The tessellated outline, one entry per piece, standing on Z=0.
 *
 * Needs the manifold module loaded, and any mesh imprints prepared, before it
 * is called; `exportFitTestOutline` does both.
 */
export function buildFitTestOutlineMeshes(
  params: BinParams,
  options: FitTestOutlineOptions = {}
): { pieces: FitTestMeshPiece[]; blockedSeams: number } {
  const module = loadedModule();
  const { heightMm, wallMm } = resolveFitTestOutlineSize(options.size);
  const rings = traceRings(params, wallMm);
  try {
    if (rings.isEmpty()) throw new Error('No cutout outline reaches the top of this bin');
    const plan = planFitTestOutlineSplit(params, options.bed, getSplitPlanePositionsMm, wallMm);
    if (plan.pieceCount <= 1) {
      return { pieces: [extrudeToMesh(rings, heightMm, '')], blockedSeams: 0 };
    }

    const xEdges = [-WINDOW_REACH_MM, ...plan.planesX, WINDOW_REACH_MM];
    const yEdges = [-WINDOW_REACH_MM, ...plan.planesY, WINDOW_REACH_MM];
    const pieces: FitTestMeshPiece[] = [];
    for (let row = 0; row + 1 < yEdges.length; row++) {
      for (let col = 0; col + 1 < xEdges.length; col++) {
        withSections((keep) => {
          const window = keep(
            module.CrossSection.square([
              xEdges[col + 1] - xEdges[col],
              yEdges[row + 1] - yEdges[row],
            ])
          );
          const placed = keep(window.translate([xEdges[col], yEdges[row]]));
          const piece = keep(rings.intersect(placed));
          if (piece.area() < MIN_ISLAND_MM2) return;
          const label = `${String.fromCharCode(65 + col)}${row + 1}`;
          pieces.push(extrudeToMesh(piece, heightMm, label));
        });
      }
    }
    return { pieces, blockedSeams: plan.blockedSeams };
  } finally {
    rings.delete();
  }
}

/** Export the outline fit test. STL only at the worker; 3MF is wrapped on the main thread. */
export async function exportFitTestOutline(
  params: BinParams,
  format: ExportFormat,
  options: FitTestOutlineOptions = {}
): Promise<FitTestExportResult> {
  if (format === 'step') {
    throw new Error('STEP export is not available for the outline fit test. Use STL or 3MF');
  }
  await getManifoldModule();
  const source = fitTestOutlineSource(params);
  if (hasMeshImprints(source)) await prepareMeshImprints(source);

  const { pieces, blockedSeams } = buildFitTestOutlineMeshes(params, options);
  return {
    pieces: pieces.map((p) => ({
      data: buildSTLBufferFromIndexed(p.vertices, p.normals, p.indices, FIT_TEST_OUTLINE_BASE_NAME),
      label: p.label,
    })),
    fileName: `${FIT_TEST_OUTLINE_BASE_NAME}.stl`,
    blockedSeams,
  };
}
