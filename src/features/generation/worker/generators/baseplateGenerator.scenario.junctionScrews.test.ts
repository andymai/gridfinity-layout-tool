// @vitest-environment node
/**
 * Geometry validation for mount-down screws at the four-pocket junctions.
 *
 * Measured on the built solids, not on the plan: the plate keeps its stock
 * height, a modelled screw passes through the post without touching plastic,
 * its head bears on plastic, and a real bin seated in each pocket around the
 * junction stays clear of the head. A bounding box or a triangle count would
 * pass a hole cut in the wrong place, a head standing in a pocket corner, or
 * one a bin's foot sits on.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { cylinder, drawCircle, intersect, measureVolume, translate } from 'brepjs';
import type { Shape3D, Sketch } from 'brepjs';
import { isOk } from '@/core/result';
import { mm } from '@/core/types';
import type { ScrewHoleParams, StoredBaseplateParams } from '@/core/types/baseplate';
import type { BinParams, ResolvedBaseplateParams } from '@/shared/types/bin';
import type { MeshData } from '../../bridge/types';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { defaultScrewHeadDiameter, screwHeadRecessDepth } from '@/shared/generation/screwHolePlan';
import { buildFullParams } from '@/features/baseplate/utils/buildFullParams';
import { initTestKernel } from '@/test/initTestKernel';
import {
  assertStructurallyValid,
  assertWatertight,
  boundingBox,
  columnCrossings,
  verticalSolidSpans,
} from './__kernel-tests__/meshAssertions';
import { seatDepth } from './__kernel-tests__/binSeating';
import { LOW_PROFILE_BAND_CUT_MM, PLATE_PROFILE_HEIGHT, SOCKET_HEIGHT } from './generatorTypes';
import { junctionScrewSeatMm } from './screwJunctionPlan';
import type {
  buildBaseplateSolid as BuildBaseplateSolid,
  generateBaseplate as GenerateBaseplate,
} from './baseplateGenerator';

let generateBaseplate: typeof GenerateBaseplate;
let buildBaseplateSolid: typeof BuildBaseplateSolid;
let generateBin: (params: BinParams) => MeshData;

beforeAll(async () => {
  await initTestKernel();
  const plateMod = await import('./baseplateGenerator');
  generateBaseplate = plateMod.generateBaseplate;
  buildBaseplateSolid = plateMod.buildBaseplateSolid;
  generateBin = (await import('./binOrchestrator')).generateBin;
}, 60_000);

const NO_OP = (): void => {};

/** The screw config a new plate starts with in the panel. */
const NEW_SCREWS: ScrewHoleParams = {
  enabled: true,
  diameter: mm(3.4),
  headStyle: 'countersink',
  headDiameter: mm(defaultScrewHeadDiameter('countersink')),
};
const HEAD_RADIUS = 3;
const SHAFT_RADIUS = 1.7;
const RECESS = screwHeadRecessDepth(NEW_SCREWS);
const SEAT = junctionScrewSeatMm(NEW_SCREWS, PLATE_PROFILE_HEIGHT, SOCKET_HEIGHT) ?? NaN;

/** A frame-only plate resolved the way the app resolves it, on a 256mm bed. */
function plate(
  over: Partial<StoredBaseplateParams> = {},
  lowProfile = false,
  size = 3
): ResolvedBaseplateParams {
  return buildFullParams(
    { ...DEFAULT_BASEPLATE_PARAMS, screwHoles: NEW_SCREWS, ...over },
    size,
    size,
    42,
    'end',
    'end',
    0.4,
    undefined,
    undefined,
    42,
    0,
    0,
    lowProfile,
    { widthMm: 256, depthMm: 256 }
  );
}

const JUNCTIONS: ReadonlyArray<readonly [number, number]> = [
  [-21, -21],
  [21, -21],
  [-21, 21],
  [21, 21],
];

const volumeOf = (shape: Shape3D): number => {
  const v = measureVolume(shape);
  if (!isOk(v)) throw new Error('measureVolume failed');
  return v.value;
};

/** Volume two solids share. */
function sharedVolume(a: Shape3D, b: Shape3D): number {
  const common = intersect(a, b);
  if (!isOk(common)) throw new Error('intersect failed');
  try {
    return volumeOf(common.value);
  } finally {
    common.value.delete();
  }
}

/**
 * An M3 flat-head screw seated at a junction of a plate `topZ` tall (Z=0 at
 * the underside), 0.05mm inside the hole on every face, so a correct cut shares
 * nothing with it. The shaft is a real M3's ø3.0 in the ø3.4 clearance hole.
 */
function modelledScrew(
  x: number,
  y: number,
  topZ: number
): { readonly head: Shape3D; readonly shaft: Shape3D } {
  const inset = 0.05;
  const headTop = topZ - SEAT - inset;
  const headBottom = headTop - RECESS;
  const section = (r: number, z: number): Sketch => drawCircle(r).sketchOnPlane('XY', z) as Sketch;
  const start = section(HEAD_RADIUS - inset, headTop);
  const head = start.loftWith([section(SHAFT_RADIUS - inset, headBottom)], { ruled: true });
  start.delete();
  const shaft = cylinder(1.5, headBottom - inset, { at: [0, 0, inset], axis: [0, 0, 1] });
  try {
    return { head: translate(head, [x, y, 0]), shaft: translate(shaft, [x, y, 0]) };
  } finally {
    head.delete();
    shaft.delete();
  }
}

describe('mount-down screws at the pocket junctions', () => {
  it('keeps a stock frame-only plate at its stock height', () => {
    const params = plate();
    expect(params.screwPadThicknessMm).toBe(0);
    const mesh = generateBaseplate(params, NO_OP, true);
    assertStructurallyValid(mesh);
    assertWatertight(mesh);
    const bb = boundingBox(mesh.vertices);
    expect(bb.maxZ - bb.minZ).toBeCloseTo(PLATE_PROFILE_HEIGHT, 2);
  });

  it('keeps a low-profile plate at its stock height too', () => {
    const params = plate({}, true);
    expect(params.screwPadThicknessMm).toBe(0);
    const bb = boundingBox(generateBaseplate(params, NO_OP, true).vertices);
    expect(bb.maxZ - bb.minZ).toBeCloseTo(PLATE_PROFILE_HEIGHT - LOW_PROFILE_BAND_CUT_MM, 2);
  });

  it('opens the shaft through the post at every junction, which the stock plate fills', () => {
    const screwed = generateBaseplate(plate(), NO_OP, true);
    const stock = generateBaseplate(plate({ screwHoles: undefined }), NO_OP, true);
    for (const [x, y] of JUNCTIONS) {
      // Off the exact junction so the ray misses shared edges.
      expect(verticalSolidSpans(screwed, x + 0.37, y + 0.21)).toEqual([]);
      expect(verticalSolidSpans(stock, x + 0.37, y + 0.21).length).toBeGreaterThan(0);
    }
  });

  it('seats the head on plastic: the post stands right under the countersink', () => {
    // Along a "+" arm the post is solid from the underside up to the cone, so
    // the column's top is the cone surface at that radius.
    const mesh = generateBaseplate(plate(), NO_OP, true);
    const topZ = boundingBox(mesh.vertices).maxZ;
    for (const r of [2.2, 2.6]) {
      const crossings = columnCrossings(mesh, -21 + r, -21);
      const coneZ = topZ - SEAT - (HEAD_RADIUS - r);
      expect(crossings[0]).toBeCloseTo(0, 2);
      expect(crossings[crossings.length - 1]).toBeCloseTo(coneZ, 1);
    }
  });

  it('passes a modelled M3 flat-head screw through without touching plastic', () => {
    const params = plate();
    const solid = buildBaseplateSolid(params, false);
    const stock = buildBaseplateSolid(plate({ screwHoles: undefined }), false);
    try {
      for (const [x, y] of JUNCTIONS) {
        const { head, shaft } = modelledScrew(x, y, PLATE_PROFILE_HEIGHT);
        try {
          expect(sharedVolume(solid, head)).toBeLessThan(0.01);
          expect(sharedVolume(solid, shaft)).toBeLessThan(0.01);
          // Anti-vacuity: the same screw in an uncut plate is buried in plastic.
          expect(sharedVolume(stock, head)).toBeGreaterThan(10);
          expect(sharedVolume(stock, shaft)).toBeGreaterThan(5);
        } finally {
          head.delete();
          shaft.delete();
        }
      }
    } finally {
      solid.delete();
      stock.delete();
    }
  });

  it('keeps a bin seated in each pocket around a junction clear of the head', () => {
    const params = plate();
    const plateMesh = generateBaseplate(params, NO_OP, true);
    const bin = generateBin({ ...DEFAULT_BIN_PARAMS, width: 1, depth: 1, height: 2 });
    const binBottom = boundingBox(bin.vertices).minZ;
    // The bin reaches the drawer the frame-only plate stands on, so that is
    // where it rests; mated rather than assumed.
    expect(seatDepth(bin, plateMesh, { dx: -42, dy: -42 }).mm).toBeGreaterThanOrEqual(
      PLATE_PROFILE_HEIGHT - 0.05
    );
    const topZ = boundingBox(plateMesh.vertices).maxZ;
    const headTop = topZ - SEAT;

    let footOverHead = 0;
    let closestAboveHead = Infinity;
    let tooHighASeatCollides = false;
    for (const [cx, cy] of [
      [-42, -42],
      [0, -42],
      [-42, 0],
      [0, 0],
    ]) {
      for (let dx = -HEAD_RADIUS; dx <= HEAD_RADIUS; dx += 0.25) {
        for (let dy = -HEAD_RADIUS; dy <= HEAD_RADIUS; dy += 0.25) {
          if (Math.hypot(dx, dy) > HEAD_RADIUS) continue;
          const crossings = columnCrossings(bin, -21 + dx + 0.013 - cx, -21 + dy + 0.017 - cy);
          if (crossings.length === 0) continue;
          footOverHead++;
          const footZ = crossings[0] - binBottom;
          closestAboveHead = Math.min(closestAboveHead, footZ - headTop);
          if (footZ < topZ - (SEAT - 0.5)) tooHighASeatCollides = true;
        }
      }
    }
    // The foot's rounded corner overhangs the head in plan, so the clearance
    // is real and not a column that simply misses the bin.
    expect(footOverHead).toBeGreaterThan(20);
    expect(closestAboveHead).toBeGreaterThanOrEqual(-0.01);
    // A head seated 0.5mm higher would sit inside the foot: the probe can fail.
    expect(tooHighASeatCollides).toBe(true);
  }, 120_000);

  it('gives the screws the corner junctions and the mount magnets the rest', () => {
    const params = plate(
      { mountMagnets: { enabled: true, diameter: mm(6.5), depth: mm(2) } },
      false,
      5
    );
    const mesh = generateBaseplate(params, NO_OP, true);
    // Screws at the four crossings one cell in from the corners: open through.
    for (const [x, y] of [
      [-63, -63],
      [63, 63],
      [63, -63],
      [-63, 63],
    ]) {
      expect(verticalSolidSpans(mesh, x + 0.37, y + 0.21)).toEqual([]);
    }
    // Four magnets went to other crossings: blind 2mm holes from the underside.
    let magnets = 0;
    for (const x of [-63, -21, 21, 63]) {
      for (const y of [-63, -21, 21, 63]) {
        const lowest = columnCrossings(mesh, x + 0.7, y + 0.4)[0];
        if (lowest !== undefined && Math.abs(lowest - 2) < 0.05) magnets++;
      }
    }
    expect(magnets).toBe(4);
  });

  it('puts every junction screw where the exported plate does, in the draft', () => {
    const params = plate();
    const exported = generateBaseplate(params, NO_OP, true);
    const draft = generateBaseplate(params, NO_OP, false, undefined, true);
    for (const [x, y] of JUNCTIONS) {
      expect(verticalSolidSpans(draft, x + 0.37, y + 0.21)).toEqual(
        verticalSolidSpans(exported, x + 0.37, y + 0.21)
      );
    }
  });

  it('falls back to a padded floor for an M4 head the posts cannot hold', () => {
    const params = plate({ screwHoles: { ...NEW_SCREWS, headDiameter: mm(8) } });
    expect(params.screwPadThicknessMm).toBeCloseTo(3.1, 6);
    const mesh = generateBaseplate(params, NO_OP, true);
    const bb = boundingBox(mesh.vertices);
    expect(bb.maxZ - bb.minZ).toBeCloseTo(PLATE_PROFILE_HEIGHT + 3.1, 2);
    // No junction is cut: the posts stay solid.
    for (const [x, y] of JUNCTIONS) {
      expect(verticalSolidSpans(mesh, x + 0.37, y + 0.21).length).toBeGreaterThan(0);
    }
  });
});
