/** The kumiko cutter for a rounded corner slab: struts become revolved wedges and chord boxes. */

import {
  drawRoundedRectangle,
  revolve,
  rotate,
  translate,
  cutAll,
  unwrap,
  polygon,
  solid,
  sketchHelix,
} from 'brepjs';
import { orientedFace, planarFace } from 'brepjs';
import type { OrientedFace, PlanarFace, Shape3D } from 'brepjs';

import type { PerfCollector } from './pipeline/perfCollector';
import type { KumikoLattice, KumikoSegment } from './patterns';
import { COPLANAR_OVERLAP } from './generatorConstants';
import { sketch } from './meshUtils';
import type { CornerSlab } from './kumikoPerimeter';
import {
  AXIS_EPSILON,
  RAD_TO_DEG,
  CHORD_MAX_PHI,
  maxStrutWidth,
  clipSegmentToURange,
  clipSegmentToURangePeriodic,
  isRedundantMarginPiece,
  extendSegment,
  fillingPiecesForRange,
} from './kumikoSegments';

type RevolveProfile = OrientedFace & PlanarFace;

type Vec3Tuple = [number, number, number];

/** Radial rect profile face on the XZ plane: r ∈ [r0, r1], z ∈ [z0, z1]. */
function radialProfileFace(r0: number, r1: number, z0: number, z1: number): RevolveProfile {
  const drawing = drawRoundedRectangle(r1 - r0, z1 - z0, 0).translate((r0 + r1) / 2, (z0 + z1) / 2);
  const face = sketch(drawing, 'XZ').face();
  const oriented = unwrap(orientedFace(face));
  // Both brands are runtime-proven above; TS's planarFace signature drops the
  // oriented brand, so restore the intersection it verified.
  return unwrap(planarFace(oriented)) as RevolveProfile;
}

/** Annular wedge around the local Z axis from φ=0 to `angle` (radians). */
function annularWedge(r0: number, r1: number, z0: number, z1: number, angle: number): Shape3D {
  const face = radialProfileFace(r0, r1, z0, z1);
  const wedge = unwrap(revolve(face, { axis: [0, 0, 1], at: [0, 0, 0], angle }));
  face.delete();
  return wedge;
}

/** Rotate a local corner solid to its start angle. */
function toCornerAngle(shape: Shape3D, phiRad: number): Shape3D {
  if (phiRad === 0) return shape;
  const rotated = rotate(shape, phiRad * RAD_TO_DEG, { axis: [0, 0, 1] });
  shape.delete();
  return rotated;
}

/**
 * Straight hexahedral strut along the chord between two corner-surface
 * points. Short filling pieces use this instead of a helix sweep: the true
 * helical strut's sagitta over ≤CHORD_MAX_PHI is below print resolution, and
 * a plain box costs a fraction of a swept helicoid in the wedge boolean.
 */
function chordBoxStrut(
  phiA: number,
  zA: number,
  phiB: number,
  zB: number,
  width: number,
  sr0: number,
  sr1: number
): Shape3D {
  // Near-tangent contacts with neighboring struts (goma ribs seat their ends
  // ON the arm edges) leave knife-edge slivers that fail to sew — export
  // showed boundary-edge cracks on the corner cylinder. A COPLANAR_OVERLAP
  // widening turns the tangency into a finite, invisible overlap.
  const pw = width + 2 * COPLANAR_OVERLAP;
  const rMid = (sr0 + sr1) / 2;
  const A: Vec3Tuple = [rMid * Math.cos(phiA), rMid * Math.sin(phiA), zA];
  const B: Vec3Tuple = [rMid * Math.cos(phiB), rMid * Math.sin(phiB), zB];
  const d: Vec3Tuple = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const dLen = Math.hypot(d[0], d[1], d[2]);
  const du: Vec3Tuple = [d[0] / dLen, d[1] / dLen, d[2] / dLen];
  const phiM = (phiA + phiB) / 2;
  const radial: Vec3Tuple = [Math.cos(phiM), Math.sin(phiM), 0];
  // In-surface perpendicular to the chord, then re-orthogonalized radial.
  const yv: Vec3Tuple = [
    radial[1] * du[2] - radial[2] * du[1],
    radial[2] * du[0] - radial[0] * du[2],
    radial[0] * du[1] - radial[1] * du[0],
  ];
  const yLen = Math.hypot(yv[0], yv[1], yv[2]);
  const yu: Vec3Tuple = [yv[0] / yLen, yv[1] / yLen, yv[2] / yLen];
  const nu: Vec3Tuple = [
    du[1] * yu[2] - du[2] * yu[1],
    du[2] * yu[0] - du[0] * yu[2],
    du[0] * yu[1] - du[1] * yu[0],
  ];

  const corners: Vec3Tuple[] = [];
  for (const base of [A, B]) {
    for (const t of [-pw / 2, pw / 2]) {
      for (const r of [sr0 - rMid, sr1 - rMid]) {
        corners.push([
          base[0] + yu[0] * t + nu[0] * r,
          base[1] + yu[1] * t + nu[1] * r,
          base[2] + yu[2] * t + nu[2] * r,
        ]);
      }
    }
  }
  // Index layout: [end][side t][radial r] → 0:A--, 1:A-+, 2:A+-, 3:A++,
  // 4:B--, 5:B-+, 6:B+-, 7:B++.
  const quads: number[][] = [
    [0, 1, 3, 2],
    [4, 6, 7, 5],
    [0, 2, 6, 4],
    [1, 5, 7, 3],
    [0, 4, 5, 1],
    [2, 3, 7, 6],
  ];
  const faces = quads.map((q) => unwrap(polygon(q.map((i) => corners[i]))));
  const box = unwrap(solid(faces));
  for (const f of faces) f.delete();
  return box;
}

/**
 * Build one corner slab's cutter in the corner-local frame (axis at origin,
 * φ measured from +X): annular wedge minus strut solids. Exact kernels only.
 */
export function buildCornerSlabCutter(
  slab: CornerSlab,
  lattice: KumikoLattice,
  bandZ0: number,
  bandHeight: number,
  outerRadius: number,
  wallThickness: number,
  perimeter: number,
  perf?: PerfCollector
): Shape3D {
  const w = lattice.strutWidth;
  const bandZ1 = bandZ0 + bandHeight;
  // Tight radial envelope: the band sits below the lip taper (TOP_KEEP_OUT),
  // so 1mm past each wall face fully pierces it. A wider reach (the flat
  // cutters' ±2·wt convention) balloons the wedge toward the corner axis and
  // grows every curved strut face — measured ~2× cost in the final boolean.
  const rIn = Math.max(outerRadius - wallThickness, 0.3);
  const rc0 = Math.max(rIn - 1, 0.1);
  const rc1 = outerRadius + 1;
  const sr0 = Math.max(rc0 - 0.5, 0.05);
  const sr1 = rc1 + 0.5;
  const rMid = (sr0 + sr1) / 2;
  const radialSpan = sr1 - sr0;
  const phiOf = (u: number): number => (u - slab.u0) / outerRadius;

  const wedge = annularWedge(rc0, rc1, bandZ0, bandZ1, Math.PI / 2);

  // Same family partition as the flat chunks: verticals, horizontals, rising,
  // falling — struts within a family are disjoint, so each family cut has no
  // tool-tool intersection work.
  const families: Shape3D[][] = [[], [], [], [], []];
  const maxW = maxStrutWidth(lattice);
  const pieces: KumikoSegment[] = [];
  for (const seg of lattice.segments) {
    for (const piece of clipSegmentToURangePeriodic(seg, slab.u0 - w, slab.u1 + w, perimeter)) {
      if (!isRedundantMarginPiece(piece, slab.u0, slab.u1)) pieces.push(piece);
    }
  }
  // Filling pieces arrive pre-positioned (absolute u, band-local z); clip each
  // to the corner's reach and keep the margin-redundancy rule — the adjacent
  // flat covers shared vertices' pieces. Non-vertical fillings become chord
  // boxes (split under CHORD_MAX_PHI): dozens of short helix sweeps per
  // corner measured 4× the whole cutter cost on filled patterns, and the
  // chord's sagitta at these spans is below print resolution.
  for (const filling of fillingPiecesForRange(lattice, slab.u0 - maxW, slab.u1 + maxW, perimeter)) {
    const clipped = clipSegmentToURange(filling, slab.u0 - maxW, slab.u1 + maxW);
    if (!clipped || isRedundantMarginPiece(clipped, slab.u0, slab.u1)) continue;
    const pw = clipped.width ?? w;
    const capped = extendSegment(clipped, pw / 2);
    const [fua, fza] = capped.a;
    const [fub, fzb] = capped.b;
    if (Math.abs(fub - fua) < AXIS_EPSILON) {
      // Vertical fillings revolve exactly and cheaply, like grid columns.
      const dPhi = pw / outerRadius;
      const phiMid = phiOf((fua + fub) / 2);
      const slab3d = annularWedge(
        sr0,
        sr1,
        Math.min(fza, fzb) + bandZ0,
        Math.max(fza, fzb) + bandZ0,
        dPhi
      );
      families[0].push(toCornerAngle(slab3d, phiMid - dPhi / 2));
      continue;
    }
    const phiA = phiOf(fua);
    const phiB = phiOf(fub);
    const steps = Math.max(1, Math.ceil(Math.abs(phiB - phiA) / CHORD_MAX_PHI));
    // Consecutive sub-chords overlap by a parameter margin: sharing their end
    // planes exactly leaves coplanar tool faces, and the resulting sliver
    // shows up as boundary-edge cracks on the corner cylinder (goma's long
    // ribs are the only fillings that split).
    const tPad = steps > 1 ? 0.02 : 0;
    for (let i = 0; i < steps; i++) {
      const t0 = Math.max(0, i / steps - tPad);
      const t1 = Math.min(1, (i + 1) / steps + tPad);
      families[4].push(
        chordBoxStrut(
          phiA + (phiB - phiA) * t0,
          fza + (fzb - fza) * t0 + bandZ0,
          phiA + (phiB - phiA) * t1,
          fza + (fzb - fza) * t1 + bandZ0,
          pw,
          sr0,
          sr1
        )
      );
    }
  }
  for (const clipped of pieces) {
    const pw = clipped.width ?? w;
    const capped = extendSegment(clipped, pw / 2);
    const [ua, zaRel] = capped.a;
    const [ub, zbRel] = capped.b;
    const za = zaRel + bandZ0;
    const zb = zbRel + bandZ0;
    const du = Math.abs(ub - ua);
    const dz = Math.abs(zb - za);

    if (du < AXIS_EPSILON) {
      // Vertical strut: small-angle revolve so both faces are radial planes.
      const dPhi = pw / outerRadius;
      const phiMid = phiOf((ua + ub) / 2);
      const slab3d = annularWedge(sr0, sr1, Math.min(za, zb), Math.max(za, zb), dPhi);
      families[0].push(toCornerAngle(slab3d, phiMid - dPhi / 2));
    } else if (dz < AXIS_EPSILON) {
      // Near-horizontal strut: thin partial revolve across its angular span.
      const zMid = (za + zb) / 2;
      const phiA = phiOf(Math.min(ua, ub));
      const phiB = phiOf(Math.max(ua, ub));
      const slab3d = annularWedge(sr0, sr1, zMid - pw / 2, zMid + pw / 2, phiB - phiA);
      families[1].push(toCornerAngle(slab3d, phiA));
    } else if (zb - za > 0 === ub - ua > 0) {
      // Rising diagonal (φ and z increase together): rectangle swept along a
      // right-handed helix — the exact strut surface, and the construction
      // whose contacts with rib fillings are proven to sew in exports.
      const lowFirst = za <= zb;
      const [uLow, zLow] = lowFirst ? [ua, za] : [ub, zb];
      const [uHigh, zHigh] = lowFirst ? [ub, zb] : [ua, za];
      const dPhi = phiOf(uHigh) - phiOf(uLow);
      const height = zHigh - zLow;
      const pitch = (height * 2 * Math.PI) / Math.abs(dPhi);
      const spine = sketchHelix(pitch, height, rMid, [0, 0, zLow], [0, 0, 1], false);
      const swept = spine.sweepSketch(
        (plane) => drawRoundedRectangle(radialSpan, pw, 0).sketchOnPlane(plane),
        { frenet: true }
      );
      families[2].push(toCornerAngle(swept, phiOf(uLow)));
    } else {
      // Falling diagonal (φ decreases as z rises): needs a LEFT-handed helix,
      // but occt-wasm's makeHelixWire has no handedness input (the brepjs
      // left-handed flag is silently dropped — both flags produce the same
      // right-handed sweep), so the sweep landed in the mirrored angular span
      // and the wedge cut swallowed the true strut location (clipped pattern
      // + holes on every corner). brepjs `mirror` on a helical sweep yields
      // an empty solid, so instead approximate with straight chord boxes
      // split under CHORD_MAX_PHI (same construction as non-vertical
      // fillings; sagitta below print resolution).
      const phiA = phiOf(ua);
      const phiB = phiOf(ub);
      const steps = Math.max(1, Math.ceil(Math.abs(phiB - phiA) / CHORD_MAX_PHI));
      // Sub-chords overlap by a parameter margin — exactly-shared end planes
      // leave coplanar tool faces that crack the corner cylinder in exports.
      const tPad = steps > 1 ? 0.02 : 0;
      for (let i = 0; i < steps; i++) {
        const t0 = Math.max(0, i / steps - tPad);
        const t1 = Math.min(1, (i + 1) / steps + tPad);
        families[3].push(
          chordBoxStrut(
            phiA + (phiB - phiA) * t0,
            za + (zb - za) * t0,
            phiA + (phiB - phiA) * t1,
            za + (zb - za) * t1,
            pw,
            sr0,
            sr1
          )
        );
      }
    }
  }

  const strutsBuiltAt = performance.now();

  let cutter = wedge;
  let strutCount = 0;
  for (const family of families) {
    if (family.length === 0) continue;
    strutCount += family.length;
    const carved = unwrap(cutAll(cutter, family, { trackEvolution: false }));
    cutter.delete();
    for (const s of family) s.delete();
    cutter = carved;
  }

  perf?.recordWallPatternSubstep(
    'kumiko_corner_cut',
    performance.now() - strutsBuiltAt,
    strutCount
  );

  const angled = toCornerAngle(cutter, slab.thetaStart);
  const positioned = translate(angled, [slab.cx, slab.cy, 0]);
  angled.delete();
  return positioned;
}
