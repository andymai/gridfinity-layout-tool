/**
 * End support for a slanted row: a solid wedge on its own Gridfinity cells
 * past the bin's footprint, whose slope is the bin's leaning outer wall moved
 * out by `SLANT_SUPPORT_GAP_MM` square to the slope. Past the slope it is capped
 * at the bin's top, so the top edge lands on it however far it leans.
 *
 * Built in a local frame where +X is the direction of the lean and z = 0 is the
 * floor's underside, then lifted onto its socket and turned to the bin's side.
 */
import {
  applyMatrix,
  box,
  clone,
  cut,
  drawRoundedRectangle,
  exportSTEP,
  fuseAll,
  getKernelCapabilities,
  intersect,
  mesh,
  meshEdges,
  rotate,
  translate,
  unwrap,
  withScope,
} from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { planSlantSupport, SLANT_SUPPORT_GAP_MM } from '@/shared/utils/slantPlan';
import type { SlantSupportPlan } from '@/shared/utils/slantPlan';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { EDGE_ANGULAR_TOLERANCE_RAD } from '@/shared/constants/tessellation';
import type { ExportFormat, MeshData } from '../../bridge/types';
import { SOCKET_HEIGHT, toIndexedMeshData, checkCancelled } from './generatorTypes';
import type { ProgressFn } from './generatorTypes';
import { CLEARANCE, COPLANAR_OVERLAP } from './generatorConstants';
import { buildBaseSocket, DEFAULT_SOCKET_CELL_PLAN } from './socketBuilder';
import { buildRidgeReliefTool } from './ridgeReliefBuilder';
import { creaseEdges } from './utils';
import { computeTessellationTolerances, EXPORT_ANGULAR_TOLERANCE_RAD } from './utils/tolerances';
import { unwrapExportBlob } from './utils/exportUnwrap';
import { exportSolidToStl } from './utils/stlMeshFallback';

const SIDE_TURN_DEG = { right: 0, back: 90, left: 180, front: -90 } as const;

interface SupportFrame {
  /** Centre of the support's footprint along the lean, from the bin's centre. */
  readonly centreMm: number;
}

function pitches(params: BinParams, plan: SlantSupportPlan): { along: number; across: number } {
  const x = params.gridUnitMm;
  const y = params.gridUnitMmY ?? params.gridUnitMm;
  return plan.slant.axis === 'x' ? { along: x, across: y } : { along: y, across: x };
}

function supportFrame(params: BinParams, plan: SlantSupportPlan): SupportFrame {
  const { along } = pitches(params, plan);
  const binUnits = plan.slant.axis === 'x' ? params.width : params.depth;
  const binHalf = (binUnits * along - CLEARANCE) / 2;
  const lengthMm = plan.lengthU * along - CLEARANCE;
  return { centreMm: binHalf + CLEARANCE + lengthMm / 2 };
}

/** The support in the local frame, centred on its own footprint, socket bottom at z = 0. */
function buildLocalSupport(params: BinParams, plan: SlantSupportPlan, forExport: boolean): Shape3D {
  const { along, across } = pitches(params, plan);
  const lengthMm = plan.lengthU * along - CLEARANCE;
  const widthMm = plan.widthU * across - CLEARANCE;
  const rise = plan.topZ - plan.pivotZ;
  const { k } = plan.slant;
  const binUnits = plan.slant.axis === 'x' ? params.width : params.depth;
  const binHalf = (binUnits * along - CLEARANCE) / 2;
  const centre = supportFrame(params, plan).centreMm;
  // The leaning wall's outer plane is x = binHalf + k·z; the slope keeps the
  // gap square to it, which horizontally is gap · sqrt(1 + k²).
  const slopeAtFloor = binHalf + SLANT_SUPPORT_GAP_MM * Math.hypot(1, k) - centre;
  const socketless = plan.pivotZ === 0;
  // Sunk into the socket so the fuse sees overlapping solids, not touching faces.
  const sink = socketless ? 0 : COPLANAR_OVERLAP;

  return withScope((scope) => {
    const radius = Math.min(
      GRIDFINITY_SPEC.BOX_CORNER_RADIUS,
      Math.min(lengthMm, widthMm) / 2 - 0.1
    );
    const prism = scope.register(
      drawRoundedRectangle(lengthMm, widthMm, Math.max(radius, 0.1))
        .sketchOnPlane('XY', -sink)
        .extrude(rise + sink)
    );
    const reach = lengthMm + widthMm + rise * (1 + k);
    const keep = scope.register(
      unwrap(
        applyMatrix(
          box(reach, widthMm + 2, rise + 2, { at: [slopeAtFloor + reach / 2, 0, rise / 2] }),
          { linear: [1, 0, k, 0, 1, 0, 0, 0, 1], translation: [0, 0, 0] }
        )
      )
    );
    let body: Shape3D = scope.register(unwrap(intersect(prism as ValidSolid, keep)));
    if (socketless) return unwrap(clone(body));

    const unitX = plan.slant.axis === 'x' ? along : across;
    const unitY = plan.slant.axis === 'x' ? across : along;
    if (plan.pivotZ < SOCKET_HEIGHT) {
      const relief = buildRidgeReliefTool(
        plan.lengthU,
        plan.widthU,
        undefined,
        { x: unitX, y: unitY },
        DEFAULT_SOCKET_CELL_PLAN
      );
      if (relief) body = scope.register(unwrap(cut(body, scope.register(relief))));
    }
    const socket = buildBaseSocket(
      plan.lengthU,
      plan.widthU,
      false,
      false,
      0,
      0,
      0,
      forExport,
      DEFAULT_SOCKET_CELL_PLAN,
      { x: unitX, y: unitY },
      undefined,
      undefined,
      undefined,
      undefined,
      plan.pivotZ
    );
    const socketClone = scope.register(unwrap(clone(socket)));
    const solid = scope.register(unwrap(fuseAll([body, socketClone] as ValidSolid[])));
    return translate(solid, [0, 0, plan.pivotZ]);
  });
}

/** The support standing beside the bin it carries, in the bin's own frame. */
export function buildPlacedSlantSupport(
  params: BinParams,
  plan: SlantSupportPlan,
  forExport: boolean
): Shape3D {
  const local = buildLocalSupport(params, plan, forExport);
  const moved = translate(local, [supportFrame(params, plan).centreMm, 0, 0]);
  local.delete();
  const turned = rotate(moved, SIDE_TURN_DEG[plan.slant.side], { axis: [0, 0, 1] });
  moved.delete();
  return turned;
}

/** Preview mesh for the support beside the bin, or null when the design has none. */
export function generateSlantSupport(
  params: BinParams,
  onProgress?: ProgressFn,
  forExport = false,
  signal?: AbortSignal
): MeshData | null {
  const plan = planSlantSupport(params);
  if (!plan) return null;
  checkCancelled(signal);
  const solid = buildPlacedSlantSupport(params, plan, forExport);
  try {
    checkCancelled(signal);
    const maxDimension =
      Math.max(plan.lengthU, plan.widthU) * Math.max(params.gridUnitMm, params.gridUnitMmY ?? 0);
    const { tolerance, angularToleranceRad } = computeTessellationTolerances(
      forExport,
      false,
      maxDimension
    );
    const shapeMesh = mesh(solid, { tolerance, angularTolerance: angularToleranceRad });
    const edgeLines =
      getKernelCapabilities().tessellationModel === 'build-time'
        ? creaseEdges(shapeMesh)
        : meshEdges(solid, { tolerance, angularTolerance: EDGE_ANGULAR_TOLERANCE_RAD }).lines;
    onProgress?.('merge', 1.0);
    return toIndexedMeshData(shapeMesh, edgeLines);
  } finally {
    solid.delete();
  }
}

export interface SlantSupportExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
}

/** The support as its own printable file, centred on itself with Z=0 at its bottom. */
export async function exportSlantSupport(
  params: BinParams,
  format: ExportFormat,
  tolerance = 0.01,
  angularTolerance = EXPORT_ANGULAR_TOLERANCE_RAD
): Promise<SlantSupportExportResult | null> {
  const plan = planSlantSupport(params);
  if (!plan) return null;
  const solid = buildLocalSupport(params, plan, true);
  const name = `gridfinity-${params.width}x${params.depth}-slant-support`;
  try {
    if (format === 'step') {
      const blob = unwrapExportBlob(exportSTEP(solid), 'STEP');
      return { data: await blob.arrayBuffer(), fileName: `${name}.step` };
    }
    const data = await exportSolidToStl(solid, name, tolerance, angularTolerance);
    return { data, fileName: `${name}.stl` };
  } finally {
    solid.delete();
  }
}
