/**
 * Tessellate the swappable label plates a socket-mode bin ships, so the 3D
 * preview can show the real parts — engraved text and icons included — rather
 * than an approximation of them.
 *
 * Preview-only. Export already has its own path (`exportLabelPlates` packs a
 * bed-sized sheet), so this never runs for export.
 *
 * Each plate is tessellated once in plate-local coordinates (centred on the
 * origin, bottom on Z=0) and carries its seated pose alongside. The preview
 * draws the same mesh twice — clicked into its socket, and again in the
 * reference row beside the bin — so a plate is never tessellated twice.
 */

import { mesh } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import type { LabelPlatesMeshData, LabelPlateMeshData } from '../../bridge/types';
import { toIndexedMeshData } from './utils';
import { computeTessellationTolerances } from './utils/tolerances';
import { checkCancelled } from './meshUtils';
import { labelPlateWidthMm } from '@/shared/constants/labelPlates';
import { buildLabelPlate, resolveUniformPlateTextSize } from './labelPlateBuilder';
import type { LabelPlateSpec } from './labelPlateBuilder';
import { planLabelPlateSeats } from './labelTabBuilder';
import type { LabelPlateSeat } from './labelTabBuilder';
import { LABEL_SOCKET_CLICK_POCKET_DEPTH_MM } from '@/shared/constants/labelPlates';
import { cutoutSocketTopZ, planCutoutSocketsForParams } from '@/shared/utils/cutoutLabelSocketPlan';

/**
 * A seat the preview can draw, from either mechanism. `slideY: 0` is the board
 * case (the plate leaves along `slideZ` instead of over a compartment), which
 * a wall-hung `LabelPlateSeat` never produces.
 */
type PreviewPlateSeat = Omit<LabelPlateSeat, 'slideY'> & {
  readonly slideY: 1 | -1 | 0;
  readonly slideZ?: 1;
  readonly yawDeg?: number;
};
import { deriveDimensions } from './pipeline/context';

/**
 * Ceiling on plates tessellated for the preview.
 *
 * A 12x12 grid is 144 compartments, and each plate carries its own text solid —
 * building all of them would stall the editing loop on every parameter change.
 * Twelve covers every realistic socket design (the socket plan already refuses
 * plates in compartments too narrow to hold one); the remainder is reported so
 * the UI can say so rather than silently showing a partial set.
 */
export const MAX_PREVIEW_LABEL_PLATES = 12;

/**
 * Every plate seat a design has, from whichever mechanism produced it.
 *
 * The two are mutually exclusive by construction (the label-tab feature is
 * unavailable on a solid bin, and a shadow board's sockets hang off cutouts
 * rather than walls), but reading both here keeps the preview's entry point
 * from having to know which kind of design it was handed.
 */
function planPlateSeats(
  params: BinParams,
  dim: ReturnType<typeof deriveDimensions>
): PreviewPlateSeat[] {
  if (params.label.enabled && (params.label.mode ?? 'text') === 'socket') {
    return planLabelPlateSeats(
      params,
      dim.innerW,
      dim.innerD,
      dim.interiorHeight,
      params.wallThickness
    );
  }
  // `wallHeight`, not `interiorHeight`: a board's fill surface hangs from the
  // raw wall top less its own top offset, which is the plane `buildCutoutCuts`
  // places every cavity against. Measuring from the lip-relieved interior
  // would seat every plate the lip taper's depth below its own pocket.
  return planCutoutPlateSeats(params, dim.innerW, dim.innerD, dim.wallHeight);
}

/**
 * Seats for a shadow board's sockets.
 *
 * A board socket is a pocket in a flat surface, so its plate leaves along +Z
 * rather than sliding over a compartment, and a 90° socket carries its yaw
 * through to the seated draw.
 */
function planCutoutPlateSeats(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): PreviewPlateSeat[] {
  const { sockets } = planCutoutSocketsForParams(params, innerW, innerD, wallHeight);
  if (sockets.length === 0) return [];
  const seatZ = cutoutSocketTopZ(params, wallHeight) - LABEL_SOCKET_CLICK_POCKET_DEPTH_MM;
  return sockets.map((socket, index) => ({
    x: socket.centerX,
    y: socket.centerY,
    z: seatZ,
    slideY: 0 as const,
    slideZ: 1 as const,
    ...(socket.vertical ? { yawDeg: 90 } : {}),
    plateWidthU: socket.widthU,
    text: socket.text,
    ...(socket.icon !== undefined ? { icon: socket.icon } : {}),
    scope: 'compartment' as const,
    index,
  }));
}

/**
 * Build preview meshes for a bin's swappable label plates.
 *
 * Returns null when the design has no sockets — text-mode tabs, labels off, or
 * no compartment wide enough to host a plate.
 */
export function generateLabelPlates(
  params: BinParams,
  signal?: AbortSignal
): LabelPlatesMeshData | null {
  checkCancelled(signal);
  const dim = deriveDimensions(params, false);
  const seats = planPlateSeats(params, dim);
  if (seats.length === 0) return null;

  const shown = seats.slice(0, MAX_PREVIEW_LABEL_PLATES);

  const specOf = (seat: (typeof seats)[number]): LabelPlateSpec => ({
    widthU: seat.plateWidthU,
    text: seat.text,
    ...(seat.icon !== undefined ? { icon: seat.icon } : {}),
  });
  const specs = shown.map(specOf);
  const opts = {
    textMode: params.textDefaults.mode === 'emboss' ? ('emboss' as const) : ('deboss' as const),
    textDepthMm: params.textDefaults.depth,
    textDefaults: params.textDefaults,
    v1Channels: true,
  };
  // Sized against EVERY planned plate, not just the ones shown: the exported
  // sheet sizes its text across the whole set, so capping the input here would
  // render the preview larger than the plates that actually print whenever a
  // longer caption sits past the ceiling.
  const uniformTextSize = resolveUniformPlateTextSize(seats.map(specOf), opts);

  // Plates are small and flat; their only curved detail is the corner radius
  // and glyph outlines, so the fine tier costs little and reads cleanly.
  const { tolerance, angularTolerance } = computeTessellationTolerances(false, true, dim.innerW);

  const plates: LabelPlateMeshData[] = [];
  for (let i = 0; i < shown.length; i++) {
    checkCancelled(signal);
    const seat = shown[i];
    let solid: Shape3D;
    try {
      solid = buildLabelPlate(specs[i], opts, uniformTextSize);
    } catch {
      // A single unbuildable plate (e.g. a pathological glyph) must not cost
      // the whole set — skip it and keep the rest, like the tab text fallback.
      continue;
    }
    try {
      // No edge lines: on a plate, crease edges trace the outline AND every
      // glyph, which reads as noise at this scale — and the preview would pay
      // kernel time plus a transferred buffer to render nothing.
      const shapeMesh = mesh(solid, { tolerance, angularTolerance });
      const indexed = toIndexedMeshData(shapeMesh);
      plates.push({
        vertices: indexed.vertices,
        normals: indexed.normals,
        indices: indexed.indices,
        triangleCount: indexed.triangleCount,
        seatX: seat.x,
        seatY: seat.y,
        // Both planners answer in the BODY frame, which `translateStage` then
        // lifts by `baseOffsetZ`: a Gridfinity socket, a tray bin's lid skirt,
        // or nothing under a flat base. A pose handed to the preview is world
        // coordinates, so the lift is applied here rather than in either
        // planner, where two copies of it could drift.
        seatZ: seat.z + dim.baseOffsetZ,
        slideY: seat.slideY,
        ...(seat.slideZ !== undefined ? { slideZ: seat.slideZ } : {}),
        ...(seat.yawDeg !== undefined ? { yawDeg: seat.yawDeg } : {}),
        widthMm: labelPlateWidthMm(seat.plateWidthU),
      });
    } finally {
      // Same WASM-heap discipline as the lid: release the OCCT solid once
      // tessellated, or it accumulates on every parameter change.
      solid.delete();
    }
  }

  if (plates.length === 0) return null;
  // Counted against the plan, not the cap: a plate skipped above (unbuildable)
  // is just as absent from the preview as one past the ceiling, and the UI's
  // "showing N of M" would under-report the design if only the cap counted.
  return { plates, omittedCount: seats.length - plates.length };
}
