/**
 * Detachable feet as a PART, alongside the bin rather than inside it.
 *
 * Follows the lid's route exactly: its own entry points, combined by the export
 * handler as a labelled piece. It deliberately does not ride the bin pipeline's
 * `deferredSolid`, which the export path fuses into the body — the one thing
 * that must never happen to something the user presses on afterwards.
 *
 * The two callers want opposite arrangements, so each gets its own:
 *  - PREVIEW shows the feet where they end up, under the bin, because that is
 *    the object being designed.
 *  - EXPORT lays them out flat on a plate, undersides on Z=0 and pins up, which
 *    is how they print: the mating taper is a 45-degree overhang in that
 *    orientation and needs no support.
 */

import {
  unwrap,
  fuseAll,
  mesh,
  meshEdges,
  translate,
  exportSTEP,
  getKernelCapabilities,
} from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { hasDetachableFeet, DETACHABLE_PIN_HOLE_DIAMETER_MM } from '@/shared/types/bin';
import type { MeshData } from '../../bridge/types';
import { footCellCentre, resolveDetachableFeet } from '@/shared/utils/detachableFeetPlan';
import { buildDetachableFeet } from './detachableFeetBuilder';
import type { ExportFormat } from '../../bridge/types';
import { SOCKET_HEIGHT } from './generatorTypes';
import { toIndexedMeshData, creaseEdges } from './utils';
import { EDGE_ANGULAR_TOLERANCE_RAD } from '@/shared/constants/tessellation';
import type { ProgressFn } from './generatorTypes';
import { unwrapExportBlob } from './utils/exportUnwrap';
import { exportSolidToStl } from './utils/stlMeshFallback';

/** Gap between feet on the print plate (mm). */
const PLATE_GAP_MM = 4;

/**
 * Build the feet for a bin, or `null` when it has none.
 *
 * `laidOut` re-arranges them onto a plate instead of leaving them assembled.
 * `forExport` picks the full 5-section socket profile; the preview gets the
 * same simplified profile every other preview socket uses.
 */
function buildFeetSolids(
  params: BinParams,
  laidOut: boolean,
  forExport: boolean
): Shape3D[] | null {
  if (!hasDetachableFeet(params.base)) return null;
  const resolved = resolveDetachableFeet(params);
  if (resolved.placements.length === 0) return null;

  const { feet, pinHoles } = buildDetachableFeet({
    placements: resolved.placements,
    armMm: resolved.armMm,
    pinDiameterMm: resolved.pinDiameterMm,
    pinHoleDiameterMm: DETACHABLE_PIN_HOLE_DIAMETER_MM,
    floorThicknessMm: params.wallThickness,
    screw: resolved.screw,
    magnet: resolved.magnet
      ? {
          diameterMm: resolved.magnet.diameterMm,
          depthMm: resolved.magnet.depthMm,
          positions: resolved.magnet.positions,
        }
      : undefined,
    forExport,
  });
  // The holes belong to the body, which this path does not build.
  pinHoles?.delete();

  if (!laidOut) return feet;

  // Normalise each foot back to its own origin, then step it along X. Spacing
  // by the grid pitch rather than a measured bounding box: the pitch is always
  // at least the foot's extent, and measuring would cost a tessellation per
  // foot to place parts that do not need to be tight.
  const pitch = params.gridUnitMm;
  return feet.map((foot, i) => {
    const centre = footCellCentre(resolved.placements[i]);
    const placed = translate(foot, [
      -centre.x + i * (pitch + PLATE_GAP_MM),
      -centre.y,
      SOCKET_HEIGHT,
    ]);
    if (placed !== foot) foot.delete();
    return placed;
  });
}

/**
 * The feet as solids, positioned under the bin. Caller owns and must delete
 * them. For the STEP compound, which holds bin + companions as separate solids.
 */
export function buildAssembledFeetSolids(params: BinParams): Shape3D[] | null {
  return buildFeetSolids(params, false, true);
}

/** Feet meshed where they sit under the bin, for the assembled preview. */
export function generateDetachableFeetMesh(
  params: BinParams,
  onProgress?: ProgressFn
): MeshData | null {
  const feet = buildFeetSolids(params, false, false);
  if (!feet) return null;
  onProgress?.('feet', 0.9);
  try {
    const compound = unwrap(fuseAll(feet as ValidSolid[], { optimisation: 'commonFace' }));
    try {
      const shapeMesh = mesh(compound, { tolerance: 0.01, angularTolerance: 5 });
      // Crease edges, exactly as the lid and the tray get them. Without these
      // the feet are the one companion part rendering as a flat silhouette
      // while everything around it is outlined.
      const edgeLines =
        getKernelCapabilities().tessellationModel === 'build-time'
          ? creaseEdges(shapeMesh)
          : meshEdges(compound, {
              tolerance: 0.01,
              angularTolerance: EDGE_ANGULAR_TOLERANCE_RAD,
            }).lines;
      return toIndexedMeshData(shapeMesh, edgeLines);
    } finally {
      if (!feet.includes(compound)) compound.delete();
    }
  } finally {
    for (const f of feet) f.delete();
  }
}

export interface DetachableFeetExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
}

/**
 * The feet as one printable plate.
 *
 * A compound of disjoint solids on purpose: they are separate parts that happen
 * to print together, so one file with N shells is what a slicer wants. Nothing
 * here fuses them into a single solid — that would weld parts the user has to
 * be able to place individually.
 */
export async function exportDetachableFeet(
  params: BinParams,
  format: ExportFormat,
  tolerance = 0.01,
  angularTolerance = 5
): Promise<DetachableFeetExportResult | null> {
  const feet = buildFeetSolids(params, true, true);
  if (!feet) return null;

  const plate = unwrap(fuseAll(feet as ValidSolid[], { optimisation: 'commonFace' }));
  const name = `gridfinity-${params.width}x${params.depth}-feet`;
  try {
    if (format === 'step') {
      const blob = unwrapExportBlob(exportSTEP(plate), 'STEP');
      return { data: await blob.arrayBuffer(), fileName: `${name}.step` };
    }
    const data = await exportSolidToStl(plate, name, tolerance, angularTolerance);
    return { data, fileName: `${name}.stl` };
  } finally {
    for (const f of feet) if (f !== plate) f.delete();
    plate.delete();
  }
}
