/**
 * Knife-block handle rest: a Gridfinity-socketed block whose top carries one
 * shallow circular-segment saddle groove per knife, each carved down to
 * exactly its knife's saddle height (see `knifeRestPlan`). A flat
 * (non-pipeline) generator following `toolRackGenerator`.
 *
 * Coordinate system (before the final Z-shift): socket occupies
 * Z ∈ [-SOCKET_HEIGHT, 0]; body rises from 0. The assembly is shifted
 * +SOCKET_HEIGHT so Z=0 is the printable bottom — the same frame the block's
 * own mesh lands in, which is what makes the plan's mm heights line up across
 * the two parts.
 */
import {
  drawRoundedRectangle,
  box,
  cylinder,
  unwrap,
  clone,
  translate,
  fuseAll,
  cut,
  withScope,
  mesh,
  meshEdges,
  exportSTEP,
  getKernelCapabilities,
} from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import type { KnifeRestPlan } from '@/shared/utils/knifeRestPlan';
import { planKnifeRest, knifeRestGrooveRadius } from '@/shared/utils/knifeRestPlan';
import type { ExportFormat, MeshData } from '../../bridge/types';
import { SOCKET_HEIGHT, toIndexedMeshData, checkCancelled } from './generatorTypes';
import type { ProgressFn } from './generatorTypes';
import { CLEARANCE, COPLANAR_OVERLAP } from './generatorConstants';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { buildBaseSocket, DEFAULT_SOCKET_CELL_PLAN } from './socketBuilder';
import { creaseEdges } from './utils';
import { EDGE_ANGULAR_TOLERANCE_RAD } from '@/shared/constants/tessellation';
import { computeTessellationTolerances } from './utils/tolerances';
import { unwrapExportBlob } from './utils/exportUnwrap';
import { exportSolidToStl } from './utils/stlMeshFallback';

/** Groove cylinders overshoot the body so the cut opens both end faces. */
const GROOVE_OVERSHOOT = 10;

export function buildKnifeRestSolid(
  params: BinParams,
  plan: KnifeRestPlan,
  forExport: boolean
): Shape3D {
  const unitX = params.gridUnitMm;
  const unitY = params.gridUnitMmY ?? params.gridUnitMm;
  const alongX = plan.side === 'left' || plan.side === 'right';
  const gridW = alongX ? plan.alongU : plan.crossU;
  const gridD = alongX ? plan.crossU : plan.alongU;
  const bodyW = gridW * unitX - CLEARANCE;
  const bodyD = gridD * unitY - CLEARANCE;
  const bodyH = plan.bodyTopZMm - SOCKET_HEIGHT;

  return withScope((scope) => {
    const radius = Math.min(GRIDFINITY_SPEC.BOX_CORNER_RADIUS, Math.min(bodyW, bodyD) / 2 - 0.1);
    const body = scope.register(
      drawRoundedRectangle(bodyW, bodyD, Math.max(radius, 0.1))
        .sketchOnPlane('XY', -COPLANAR_OVERLAP)
        .extrude(bodyH + COPLANAR_OVERLAP)
    );

    const socket = buildBaseSocket(
      gridW,
      gridD,
      false,
      false,
      0,
      0,
      0,
      forExport,
      DEFAULT_SOCKET_CELL_PLAN,
      { x: unitX, y: unitY }
    );
    const socketClone = scope.register(unwrap(clone(socket)));
    let solid: Shape3D = scope.register(
      unwrap(fuseAll([body, socketClone] as ValidSolid[], { optimisation: 'commonFace' }))
    );

    // Saddle grooves: one horizontal cylinder per knife, axis along the knife
    // direction, sunk so the segment it cuts is groove-width wide at the top
    // and bottoms out on the knife's saddle line.
    const alongExtent = (alongX ? bodyW : bodyD) + 2 * GROOVE_OVERSHOOT;
    for (const groove of plan.grooves) {
      const r = knifeRestGrooveRadius(groove.widthMm, groove.depthMm);
      const centerZ = bodyH - groove.depthMm + r;
      const at: [number, number, number] = alongX
        ? [-alongExtent / 2, groove.centre, centerZ]
        : [groove.centre, -alongExtent / 2, centerZ];
      const cutter = scope.register(
        cylinder(r, alongExtent, { at, axis: alongX ? [1, 0, 0] : [0, 1, 0] })
      );
      solid = scope.register(unwrap(cut(solid, cutter)));
    }

    return translate(solid, [0, 0, SOCKET_HEIGHT]);
  });
}

/** The slice of pipeline dimensions the integrated rest needs. */
export interface IntegratedRestDims {
  readonly innerW: number;
  readonly innerD: number;
  readonly wallHeight: number;
  readonly collarHeight: number;
}

/**
 * Cut tools for the INTEGRATED rest: a shelf carved out of the block's own
 * rear section (the exit side), dropped to the derived rest height, with the
 * saddle grooves sunk into it. Emitted in the same frame as the solid-mode
 * cutout tools (z=0 at the interior floor, XY centred on the interior), so
 * featuresStage can append them to `cutTargets` untouched. Empty when the
 * design has no integrated rest.
 */
export function buildIntegratedKnifeRestTools(
  params: BinParams,
  dims: IntegratedRestDims
): Shape3D[] {
  const plan = planKnifeRest(params);
  if (!plan || plan.style !== 'integrated') return [];

  const unitX = params.gridUnitMm;
  const unitY = params.gridUnitMmY ?? params.gridUnitMm;
  const alongX = plan.side === 'left' || plan.side === 'right';
  const bodyW = dims.innerW + 2 * params.wallThickness;
  const bodyD = dims.innerD + 2 * params.wallThickness;
  const lengthMm = plan.alongU * (alongX ? unitX : unitY);
  const alongHalf = (alongX ? bodyW : bodyD) / 2;
  const crossSpan = (alongX ? bodyD : bodyW) + 2 * GROOVE_OVERSHOOT;
  const shelfTopZ = plan.bodyTopZMm - SOCKET_HEIGHT;
  const dropTopZ =
    dims.wallHeight + dims.collarHeight + GRIDFINITY_SPEC.LIP_HEIGHT + GROOVE_OVERSHOOT;
  if (shelfTopZ >= dropTopZ || lengthMm <= 0) return [];

  // The dropped region reaches from the step face out past the exit wall (and
  // its lip); the sign of the along-axis places it against the right wall.
  const outward = plan.side === 'right' || plan.side === 'back' ? 1 : -1;
  const dropLen = lengthMm + GROOVE_OVERSHOOT;
  const alongCenter = outward * (alongHalf - lengthMm + dropLen / 2);

  const tools: Shape3D[] = [];
  const dropH = dropTopZ - shelfTopZ;
  tools.push(
    box(alongX ? dropLen : crossSpan, alongX ? crossSpan : dropLen, dropH, {
      at: [alongX ? alongCenter : 0, alongX ? 0 : alongCenter, shelfTopZ + dropH / 2],
    })
  );

  // Grooves end at the step face (a hair inside it, so the boolean never sees
  // a coincident face) and run out past the exit wall.
  const grooveLen = lengthMm + GROOVE_OVERSHOOT + COPLANAR_OVERLAP;
  const grooveStart = outward * (alongHalf - lengthMm - COPLANAR_OVERLAP);
  for (const groove of plan.grooves) {
    const r = knifeRestGrooveRadius(groove.widthMm, groove.depthMm);
    const centerZ = shelfTopZ - groove.depthMm + r;
    tools.push(
      cylinder(r, grooveLen, {
        at: alongX ? [grooveStart, groove.centre, centerZ] : [groove.centre, grooveStart, centerZ],
        axis: alongX ? [outward, 0, 0] : [0, outward, 0],
      })
    );
  }
  return tools;
}

/** Preview/export mesh for the companion handle rest, or null when none applies. */
export function generateKnifeRest(
  params: BinParams,
  onProgress?: ProgressFn,
  forExport = false,
  signal?: AbortSignal
): MeshData | null {
  const plan = planKnifeRest(params);
  if (!plan || plan.style !== 'companion') return null;

  checkCancelled(signal);
  const solid = buildKnifeRestSolid(params, plan, forExport);
  try {
    checkCancelled(signal);
    const maxDimension =
      Math.max(plan.alongU, plan.crossU) * Math.max(params.gridUnitMm, params.gridUnitMmY ?? 0);
    const { tolerance, angularTolerance } = computeTessellationTolerances(
      forExport,
      false,
      maxDimension
    );
    const shapeMesh = mesh(solid, { tolerance, angularTolerance });
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

export interface KnifeRestExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
}

/**
 * The companion rest as its own printable file, in its own print frame (Z=0
 * bottom, XY centred on itself) — it is a separate part, so the mating step
 * belongs to whatever assembles the two. Null for every design the plan
 * rejects and for the integrated style, which is carved out of the block.
 */
export async function exportKnifeRest(
  params: BinParams,
  format: ExportFormat,
  tolerance = 0.01,
  angularTolerance = 5
): Promise<KnifeRestExportResult | null> {
  const plan = planKnifeRest(params);
  if (!plan || plan.style !== 'companion') return null;

  const solid = buildKnifeRestSolid(params, plan, true);
  const name = `gridfinity-${params.width}x${params.depth}-knife-rest`;
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
