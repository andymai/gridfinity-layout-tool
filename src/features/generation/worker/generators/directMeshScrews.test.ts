// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mm } from '@/core/types';
import type { ScrewHoleParams } from '@/core/types/baseplate';
import type { MeshData } from '../../bridge/types';
import { MeshBuilder, CANCEL_EPSILON, CIRCLE_SEGMENTS } from './directMeshBuilder';
import { PLATE_PROFILE_HEIGHT } from './generatorTypes';
import { screwHeadRecessDepth } from '@/shared/generation/screwHolePlan';
import { addScrewHoleAt } from './directMeshScrews';

const COUNTERSINK: ScrewHoleParams = {
  enabled: true,
  diameter: mm(3.4),
  headStyle: 'countersink',
};

const COUNTERBORE: ScrewHoleParams = { ...COUNTERSINK, headStyle: 'counterbore' };

/** Plate with the pad a floor-sited screw needs (recess 2.3 + retain 0.8). */
const PAD = 3.1;
const TOTAL_HEIGHT = PLATE_PROFILE_HEIGHT + PAD;

function build(
  params: ScrewHoleParams,
  site: 'margin' | 'floor',
  x = 0,
  y = 0,
  totalHeight = TOTAL_HEIGHT
): MeshData {
  const mb = new MeshBuilder();
  addScrewHoleAt(mb, { x, y, site }, params, totalHeight, PLATE_PROFILE_HEIGHT);
  return mb.build();
}

const M3_FLAT: ScrewHoleParams = { ...COUNTERSINK, headDiameter: mm(6) };

function buildJunction(params: ScrewHoleParams, seat: number): MeshData {
  const mb = new MeshBuilder();
  addScrewHoleAt(
    mb,
    { x: 0, y: 0, site: 'junction', seatBelowTopMm: seat },
    params,
    PLATE_PROFILE_HEIGHT,
    PLATE_PROFILE_HEIGHT
  );
  return mb.build();
}

/** Highest vertex within 0.01mm of a point in plan. */
function topAt(mesh: MeshData, x: number, y: number): number {
  let top = -Infinity;
  for (let i = 0; i < mesh.vertices.length; i += 3) {
    if (Math.hypot(mesh.vertices[i] - x, mesh.vertices[i + 1] - y) > 0.01) continue;
    top = Math.max(top, mesh.vertices[i + 2]);
  }
  return top;
}

function zRange(mesh: MeshData): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 2; i < mesh.vertices.length; i += 3) {
    min = Math.min(min, mesh.vertices[i]);
    max = Math.max(max, mesh.vertices[i]);
  }
  return { min, max };
}

/** Largest distance from the hole axis among vertices sitting at plane `z`. */
function radiusAtZ(mesh: MeshData, z: number, cx = 0, cy = 0): number {
  let found = -1;
  for (let i = 0; i < mesh.vertices.length; i += 3) {
    if (Math.abs(mesh.vertices[i + 2] - z) > 1e-4) continue;
    found = Math.max(found, Math.hypot(mesh.vertices[i] - cx, mesh.vertices[i + 1] - cy));
  }
  return found;
}

/** Vertices at plane `z` whose authored normal points along `sign`. */
function facesAtZ(mesh: MeshData, z: number, sign: 1 | -1): number {
  let count = 0;
  for (let i = 0; i < mesh.vertices.length; i += 3) {
    if (Math.abs(mesh.vertices[i + 2] - z) > 1e-4) continue;
    if (sign > 0 ? mesh.normals[i + 2] > 0.9 : mesh.normals[i + 2] < -0.9) count++;
  }
  return count;
}

describe('addScrewHoleAt', () => {
  it('emits geometry', () => {
    const mesh = build(COUNTERSINK, 'floor');
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.triangleCount).toBeGreaterThan(0);
  });

  it('runs a margin hole from the top face clear through the underside', () => {
    const { min, max } = zRange(build(COUNTERSINK, 'margin'));
    expect(max).toBeCloseTo(TOTAL_HEIGHT, 6);
    expect(min).toBeCloseTo(0, 6);
  });

  it('enters a floor hole at the pocket floor, not the top face', () => {
    // The pocket floor sits PLATE_PROFILE_HEIGHT below the top; entering at the top
    // would carve a cone through the middle of the socket a bin seats in.
    const { min, max } = zRange(build(COUNTERSINK, 'floor'));
    expect(max).toBeCloseTo(TOTAL_HEIGHT - PLATE_PROFILE_HEIGHT, 6);
    expect(min).toBeCloseTo(0, 6);
  });

  it('punches the entry surface with a -Z cancel face just below it', () => {
    const mesh = build(COUNTERSINK, 'floor');
    // CIRCLE_SEGMENTS rim vertices + 1 center.
    expect(facesAtZ(mesh, PAD - CANCEL_EPSILON, -1)).toBe(CIRCLE_SEGMENTS + 1);
  });

  it('opens on the bottom face with a +Z cancel face just above it', () => {
    // A screw that stops inside the plate fastens nothing, and the slab bottom
    // is a solid face the shaft has to punch.
    const mesh = build(COUNTERSINK, 'floor');
    expect(facesAtZ(mesh, CANCEL_EPSILON, 1)).toBe(CIRCLE_SEGMENTS + 1);
    expect(radiusAtZ(mesh, CANCEL_EPSILON)).toBeCloseTo(COUNTERSINK.diameter / 2, 6);
  });

  it('makes the countersink head-wide at the entry plane and shaft-wide below it', () => {
    const mesh = build(COUNTERSINK, 'floor');
    const recess = screwHeadRecessDepth(COUNTERSINK);
    expect(recess).toBeCloseTo(2.3, 1);
    expect(radiusAtZ(mesh, PAD)).toBeCloseTo(4, 6);
    expect(radiusAtZ(mesh, PAD - recess)).toBeCloseTo(1.7, 6);
  });

  it('makes the counterbore a flat pocket of the head diameter', () => {
    const bore: ScrewHoleParams = { ...COUNTERBORE, counterboreDepth: mm(2) };
    const mesh = build(bore, 'floor');
    expect(radiusAtZ(mesh, PAD)).toBeCloseTo(5.5 / 2, 6);
    // Full head width all the way down to the shoulder the head seats on.
    expect(radiusAtZ(mesh, PAD - 2)).toBeCloseTo(5.5 / 2, 6);
    expect(facesAtZ(mesh, PAD - 2, 1)).toBe(2 * CIRCLE_SEGMENTS);
  });

  it('honours an explicit head diameter', () => {
    const wide: ScrewHoleParams = { ...COUNTERSINK, headDiameter: mm(10) };
    expect(radiusAtZ(build(wide, 'floor'), PAD)).toBeCloseTo(5, 6);
  });

  it('centres the hole on the requested position', () => {
    const mesh = build(COUNTERSINK, 'floor', 55, -13);
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      expect(Math.hypot(mesh.vertices[i] - 55, mesh.vertices[i + 1] + 13)).toBeLessThanOrEqual(
        4.001
      );
    }
  });

  it('emits nothing when the entry plane is already the underside', () => {
    // A through-cut plate has no floor to enter, and the BREP cut removes no
    // material there either.
    expect(build(COUNTERSINK, 'floor', 0, 0, PLATE_PROFILE_HEIGHT).triangleCount).toBe(0);
  });

  it('keeps the recess inside a plate whose pad falls short', () => {
    // 1mm of floor cannot host a 2.3mm cone. The draft truncates it rather than
    // hanging the cone below the plate.
    const mesh = build(COUNTERSINK, 'floor', 0, 0, PLATE_PROFILE_HEIGHT + 1);
    const { min, max } = zRange(mesh);
    expect(min).toBeCloseTo(0, 6);
    expect(max).toBeCloseTo(1, 6);
  });

  it('seats a junction head at its seat plane and runs the shaft out the underside', () => {
    const seat = 1.25;
    const mesh = buildJunction(M3_FLAT, seat);
    const zSeat = PLATE_PROFILE_HEIGHT - seat;
    expect(radiusAtZ(mesh, zSeat)).toBeCloseTo(3, 6);
    expect(radiusAtZ(mesh, zSeat - screwHeadRecessDepth(M3_FLAT))).toBeCloseTo(1.7, 6);
    expect(zRange(mesh).min).toBeCloseTo(0, 6);
  });

  it('punches no entry face at a junction, where the post is a knife edge', () => {
    const seat = 1.25;
    const mesh = buildJunction(M3_FLAT, seat);
    expect(facesAtZ(mesh, PLATE_PROFILE_HEIGHT - seat - CANCEL_EPSILON, -1)).toBe(0);
  });

  it('raises the bore wall only where the bore passes through the post', () => {
    // Along a "+" arm the post rises to the top face; on the diagonal the pocket
    // corner is air down to 1.34mm, where a 3mm radius meets its arc.
    const seat = 1.25;
    const mesh = buildJunction(M3_FLAT, seat);
    expect(topAt(mesh, 3, 0)).toBeCloseTo(PLATE_PROFILE_HEIGHT, 6);
    expect(topAt(mesh, 3 / Math.SQRT2, 3 / Math.SQRT2)).toBeCloseTo(PLATE_PROFILE_HEIGHT - seat, 6);
  });

  it('shares ring vertices between the walls of one band', () => {
    // A band that duplicated its rings per quad would emit 4 vertices per
    // segment and shade as a faceted prism.
    const plain: ScrewHoleParams = { ...COUNTERBORE, counterboreDepth: mm(0) };
    const mesh = build(plain, 'floor');
    // Two cancel discs (CIRCLE_SEGMENTS + 1 each) + one shared-ring shaft band.
    expect(mesh.vertices.length / 3).toBe(2 * (CIRCLE_SEGMENTS + 1) + 2 * CIRCLE_SEGMENTS);
  });
});
