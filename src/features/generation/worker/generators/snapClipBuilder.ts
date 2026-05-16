import { draw, unwrap, mesh, exportSTL } from 'brepjs';
import type { Drawing, Shape3D, ValidSolid } from 'brepjs';
import type { ExportFormat } from '../../bridge/types';
import {
  SNAP_CLIP_LENGTH,
  SNAP_CLIP_WIDTH,
  SNAP_CLIP_DEPTH,
  SNAP_CLIP_SNAP,
  SNAP_CLIP_THICKNESS,
  SNAP_CLIP_COMPRESSION,
  SNAP_CLIP_CLEARANCE,
  SNAP_CLIP_DEPTH_CLEARANCE,
} from './generatorConstants';

// BOSL2 rabbit_clip ported to brepjs. A flat, solid, lay-flat clip whose two
// ear bumps protrude past the socket's nominal width — the resulting press-
// fit holds the pieces together. Two halves back-to-back ("double" form)
// span a baseplate seam: one half in each piece's socket.
//
// Note on solid vs hollow: BOSL2 produces a thin-walled spring (offset_stroke
// of the centerline) and instructs the slicer to print 2 walls + 0% infill.
// We extrude a solid here — that loses the spring flex but works regardless
// of slicer settings, and the compression-driven interference fit is enough
// to lock the seam in practice.
//
// Source/reference:
//   https://github.com/BelfrySCAD/BOSL2/blob/master/joiners.scad#L999
//   https://github.com/jcorbin/gridfinity-risers (baseplate usage)

/**
 * Build the closed 2D outline of one pin half in canonical orientation:
 * base at Y=0 (full width along X), tip extending toward +Y. Polygonal
 * approximation of BOSL2's Bezier-smoothed path — the mechanical snap
 * comes from ear protrusion + waist indent, not curve smoothness.
 */
function rabbitPinOutline(
  length: number,
  width: number,
  snap: number,
  compression: number,
  thickness: number
): Drawing {
  const earwidth = 2 * thickness + snap;
  const pointLength = earwidth / 2.15;
  const scaledLen =
    length -
    (0.5 * (earwidth * snap + pointLength * length)) / Math.sqrt(snap * snap + (length / 2) ** 2);
  const bottomPtY = Math.max(scaledLen * 0.15 + thickness, 2 * thickness);

  const halfW = width / 2;
  const earX = halfW + compression;
  const waistX = halfW - snap;
  const tipOutX = halfW * 0.4;
  const tipOutY = scaledLen + thickness * 0.5;
  const tipInX = thickness;
  const tipInY = scaledLen - thickness * 0.5;

  return draw([halfW, 0])
    .lineTo([waistX, scaledLen / 2])
    .lineTo([earX, scaledLen])
    .lineTo([tipOutX, tipOutY])
    .lineTo([tipInX, tipInY])
    .lineTo([0, bottomPtY])
    .lineTo([-tipInX, tipInY])
    .lineTo([-tipOutX, tipOutY])
    .lineTo([-earX, scaledLen])
    .lineTo([-waistX, scaledLen / 2])
    .lineTo([-halfW, 0])
    .close();
}

/**
 * Combined outline of a "double" clip: two pin halves joined at Y=0. The
 * shared Y=0 edge becomes interior after fusion, leaving a single contour
 * around the full silhouette. Side walls bridge the two halves.
 */
function doublePinOutline(
  length: number,
  width: number,
  snap: number,
  compression: number,
  thickness: number
): Drawing {
  const upper = rabbitPinOutline(length, width, snap, compression, thickness);
  const lower = upper.mirror([1, 0], [0, 0], 'plane');
  return upper.fuse(lower);
}

/** Build the double clip ready to print (lay-flat, depth axis = Z). */
export function buildSnapClip(): Shape3D {
  const outline = doublePinOutline(
    SNAP_CLIP_LENGTH,
    SNAP_CLIP_WIDTH,
    SNAP_CLIP_SNAP,
    SNAP_CLIP_COMPRESSION,
    SNAP_CLIP_THICKNESS
  );
  return outline.sketchOnPlane('XY').extrude(SNAP_CLIP_DEPTH) as Shape3D;
}

/**
 * Cutter for a single socket — a solid pocket cut into the slab edge that
 * matches one pin half of the clip plus clearance. Canonical orientation:
 * pin base at Y=0, pin extending toward +Y. Extruded vertically over a
 * depth slightly greater than the clip's depth so the clip drops in cleanly.
 *
 * Clearance is baked into the path parameters (width + length grown by
 * 2*clearance) rather than applied as a brepjs `.offset()` — OCCT's wire
 * offset fails on the sharp inner-notch concavity at the pin tip.
 *
 * The caller is responsible for rotating/translating into world coordinates
 * for each seam edge.
 */
export function buildSnapSocketCutter(): Shape3D {
  const outline = rabbitPinOutline(
    SNAP_CLIP_LENGTH + 2 * SNAP_CLIP_CLEARANCE,
    SNAP_CLIP_WIDTH + 2 * SNAP_CLIP_CLEARANCE,
    SNAP_CLIP_SNAP,
    0,
    SNAP_CLIP_THICKNESS
  );
  return outline
    .sketchOnPlane('XY')
    .extrude(SNAP_CLIP_DEPTH + SNAP_CLIP_DEPTH_CLEARANCE) as Shape3D;
}

export async function exportSnapClip(
  format: ExportFormat,
  tolerance = 0.01,
  angularTolerance = 5
): Promise<{ data: ArrayBuffer; fileName: string }> {
  const clip = buildSnapClip() as ValidSolid;
  try {
    if (format === 'step') {
      const { exportSTEP } = await import('brepjs');
      const blob = unwrap(exportSTEP(clip));
      return { data: await blob.arrayBuffer(), fileName: 'snap-clip.step' };
    }
    mesh(clip, { tolerance, angularTolerance, cache: false });
    const blob = unwrap(exportSTL(clip, { tolerance, angularTolerance, binary: true }));
    return { data: await blob.arrayBuffer(), fileName: 'snap-clip.stl' };
  } finally {
    clip.delete();
  }
}
