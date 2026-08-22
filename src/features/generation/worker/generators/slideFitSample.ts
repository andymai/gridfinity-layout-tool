/**
 * Sliding-tray fit-calibration coupon.
 *
 * `clearanceMm` is the number a maker has to tune per printer, and the only
 * way to find it today is to print a whole bin plus a whole tray and discover
 * the tray binds. This card sweeps the clearance across a ladder on short rail
 * stubs, with ONE tray stub that runs in all of them: the stub that slides best
 * names the value to type into the field.
 *
 * Only the RAIL spacing varies across the ladder, never the tray. Varying both
 * would test each pair against itself and tell the maker nothing, since every
 * rung would fit equally well.
 *
 * The rung's rail profile is built here rather than through
 * `resolveSlideGeometry`, because the resolver dimensions a rail against a
 * BIN's walls and there is no bin here. It takes its shelf reach and thickness
 * from the same `SlideConfig` the real rail uses, so the mating faces match;
 * what the card cannot tell you is anything about the bin-specific placement
 * (lip clearance, drop, span).
 *
 * Export mirrors `labelFitSample`: pieces → compound → one ready-to-slice file.
 */

import { compound, mesh, exportSTEP, translate, unwrap, draw, cut, clone } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { SlideConfig } from '@/shared/types/bin';
import type { ExportFormat } from '../../bridge/types';
import { sketch } from './meshUtils';
import { buildBaseplateSTL } from './baseplateSTL';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { PREVIEW_ANGULAR_TOLERANCE_RAD } from './utils/tolerances';

/** Clearances swept across the coupons, in mm per side. */
export const SLIDE_FIT_SAMPLE_CLEARANCES: readonly number[] = [0.15, 0.2, 0.25, 0.3, 0.35];

/** Length of each rail stub along the slide axis. Long enough to feel a bind. */
const STUB_LENGTH_MM = 30;
/** Depth of the tray stub across the rails. */
const TRAY_DEPTH_MM = 24;
/** Height of the tray stub's walls. Shallow: this is a fit gauge, not a tray. */
const TRAY_WALL_H_MM = 6;
const TRAY_WALL_MM = 1.2;
/** Slab under each rail pair, so a stub is a self-supporting printable part. */
const BASE_THICKNESS_MM = 2;
/** Gap between coupons in the row, and between the row and the tray stub. */
const GAP_MM = 6;

function box(
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  zMin: number,
  zMax: number
): Shape3D {
  const profile = draw([xMin, yMin])
    .lineTo([xMax, yMin])
    .lineTo([xMax, yMax])
    .lineTo([xMin, yMax])
    .close();
  const extruded = sketch(profile, 'XY').extrude(zMax - zMin);
  const placed = translate(extruded, [0, 0, zMin]);
  extruded.delete();
  return placed;
}

/**
 * One rung: a slab carrying two L-rails whose guides sit `clearance` clear of
 * the tray stub on each side.
 *
 * The ladder is read by feel rather than by an embossed number: the rungs are
 * emitted in ascending order along Y, so the winning rung's INDEX names the
 * clearance without spending glyphs that a 0.4mm nozzle would smear anyway.
 */
export function buildSlideFitRung(clearance: number, slide: SlideConfig): Shape3D[] {
  const halfChannel = TRAY_DEPTH_MM / 2 + clearance;
  const shelf = slide.railProtrusionMm;
  const thick = slide.railThicknessMm;
  const outerY = halfChannel + shelf + thick;

  const pieces: Shape3D[] = [
    box(-STUB_LENGTH_MM / 2, STUB_LENGTH_MM / 2, -outerY, outerY, 0, BASE_THICKNESS_MM),
  ];
  for (const side of [-1, 1] as const) {
    // Guide wall, standing outboard of the channel.
    pieces.push(
      box(
        -STUB_LENGTH_MM / 2,
        STUB_LENGTH_MM / 2,
        side < 0 ? -outerY : halfChannel,
        side < 0 ? -halfChannel : outerY,
        BASE_THICKNESS_MM,
        BASE_THICKNESS_MM + thick * 2
      )
    );
    // Shelf reaching inward over the channel, at the guide's mid height, so
    // the tray stub rests on it exactly as it would on a real rail.
    pieces.push(
      box(
        -STUB_LENGTH_MM / 2,
        STUB_LENGTH_MM / 2,
        side < 0 ? -halfChannel : halfChannel - shelf,
        side < 0 ? -halfChannel + shelf : halfChannel,
        BASE_THICKNESS_MM,
        BASE_THICKNESS_MM + thick
      )
    );
  }
  return pieces;
}

/** The tray stub that runs in every rung: one part, nominal size. */
export function buildSlideFitTrayStub(): Shape3D[] {
  const outer = box(
    -STUB_LENGTH_MM / 2,
    STUB_LENGTH_MM / 2,
    -TRAY_DEPTH_MM / 2,
    TRAY_DEPTH_MM / 2,
    0,
    TRAY_WALL_H_MM
  );
  const cavity = box(
    -(STUB_LENGTH_MM - 2 * TRAY_WALL_MM) / 2,
    (STUB_LENGTH_MM - 2 * TRAY_WALL_MM) / 2,
    -(TRAY_DEPTH_MM - 2 * TRAY_WALL_MM) / 2,
    (TRAY_DEPTH_MM - 2 * TRAY_WALL_MM) / 2,
    TRAY_WALL_MM,
    TRAY_WALL_H_MM + 1
  );
  try {
    const hollow = cut(outer as ValidSolid, cavity as ValidSolid);
    // A failed boolean yields the solid block rather than losing the card: the
    // stub's OUTER size is what the fit is read from, and that is unaffected.
    return [hollow.ok ? hollow.value : unwrap(clone(outer))];
  } finally {
    outer.delete();
    cavity.delete();
  }
}

/** Build the whole card: the clearance ladder plus one tray stub beside it. */
export function buildSlideFitSampleCard(slide: SlideConfig = DEFAULT_BIN_PARAMS.slide): Shape3D[] {
  const pieces: Shape3D[] = [];
  const rowPitch = TRAY_DEPTH_MM + 4 * slide.railProtrusionMm + GAP_MM;
  const n = SLIDE_FIT_SAMPLE_CLEARANCES.length;
  const originY = ((n - 1) * rowPitch) / 2;

  SLIDE_FIT_SAMPLE_CLEARANCES.forEach((clearance, i) => {
    for (const piece of buildSlideFitRung(clearance, slide)) {
      const placed = translate(piece, [0, originY - i * rowPitch, 0]);
      piece.delete();
      pieces.push(placed);
    }
  });

  const stubX = STUB_LENGTH_MM + GAP_MM;
  for (const piece of buildSlideFitTrayStub()) {
    const placed = translate(piece, [stubX, 0, 0]);
    piece.delete();
    pieces.push(placed);
  }
  return pieces;
}

/** Export the fit-calibration card as a single STL or STEP file. */
export async function exportSlideFitSample(
  format: ExportFormat,
  slide: SlideConfig = DEFAULT_BIN_PARAMS.slide,
  tolerance?: number,
  angularTolerance?: number
): Promise<{ data: ArrayBuffer; fileName: string }> {
  const pieces = buildSlideFitSampleCard(slide);
  let assembled: Shape3D;
  try {
    assembled = compound(pieces);
  } finally {
    for (const p of pieces) p.delete();
  }

  try {
    const name = 'slide_fit_sample';
    if (format === 'step') {
      const blob = unwrap(exportSTEP(assembled));
      return { data: await blob.arrayBuffer(), fileName: `${name}.step` };
    }
    // Every fit-critical face here is planar, so the fine default would only
    // bloat the rounded nothing this card contains.
    const meshResult = mesh(assembled, {
      tolerance: tolerance ?? 0.05,
      angularTolerance: angularTolerance ?? PREVIEW_ANGULAR_TOLERANCE_RAD,
    });
    return { data: buildBaseplateSTL(meshResult, name), fileName: `${name}.stl` };
  } finally {
    assembled.delete();
  }
}
