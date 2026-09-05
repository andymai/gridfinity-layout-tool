// @vitest-environment node
/**
 * A detachable foot is only useful if it drops into a baseplate pocket, and
 * nothing about that is visible to a bounding-box, triangle-count or watertight
 * assertion: a foot built from a SCALED profile is a perfectly valid solid of
 * plausible size that simply perches on the pocket instead of entering it.
 *
 * So the central check here compares the foot's outer surface against a full
 * integral foot's at every breakpoint of the socket profile. They must agree
 * exactly, not closely — the foot is meant to BE a section of that profile, and
 * any drift is the kind that shows up as a bin sitting 4.75mm proud rather than
 * as anything a mesh check would flag.
 *
 * The rest pins down what the plan and the builder have to agree about: pins
 * that stop short of breaking through the floor, holes where the plan put them,
 * and a magnet pocket that opens downward so the magnet can be inserted.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { Shape3D } from 'brepjs';
import type { MeshData } from '@/features/generation/bridge/types';
import { initTestKernel } from '@/test/initTestKernel';
import {
  footArmMm,
  footPinPositions,
  resolveDetachableFeet,
  type FootPlacement,
} from '@/shared/utils/detachableFeetPlan';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { boundingBox, isSolidThrough, meshTopologyStats } from './__kernel-tests__/meshAssertions';
import { seatDepth } from './__kernel-tests__/binSeating';
import {
  DETACHABLE_PIN_HOLE_DIAMETER_MM,
  DETACHABLE_PIN_LEAD_IN_MM,
  DETACHABLE_PIN_TARGET_ENGAGEMENT_MM,
  binFloorMm,
  detachablePinEngagementMm,
  type FootLattice,
} from '@/shared/types/bin';

import type { DetachableFeetGeometry, DetachableFeetOptions } from './detachableFeetBuilder';

let MATING_RIM_RELIEF_MM: number;

type BuildFeet = (opts: DetachableFeetOptions) => DetachableFeetGeometry;
type BuildCell = (w: number, d: number) => Shape3D;

let buildDetachableFeet: BuildFeet;
let buildSingleCellSocket: BuildCell;
let meshOf: (shape: Shape3D) => MeshData;

beforeAll(async () => {
  await initTestKernel();
  const feetModule = await import('./detachableFeetBuilder');
  buildDetachableFeet = feetModule.buildDetachableFeet;
  MATING_RIM_RELIEF_MM = feetModule.MATING_RIM_RELIEF_MM;
  buildSingleCellSocket = (await import('./socketBuilder')).buildSingleCellSocket;
  const { mesh } = await import('brepjs');
  const { toIndexedMeshData } = await import('./meshUtils');
  meshOf = (shape) => {
    const indexed = toIndexedMeshData(mesh(shape, { tolerance: 0.01, angularTolerance: 0.1 }));
    return {
      vertices: indexed.vertices,
      indices: indexed.indices,
      triangleCount: indexed.triangleCount,
    } as MeshData;
  };
}, 60000);

const PITCH = 42;
const CLEARANCE = 0.5;
const FLOOR = 1.2;
const MEMBRANE = 0.4;
const PIN = 3;
const MAGNET_D = 6.5;
const MAGNET_DEPTH = 2;
const ARM = footArmMm({ magnetDiameterMm: MAGNET_D, magnetInsetFromEdgeMm: 8, pinDiameterMm: PIN });

/**
 * Z of every socket-profile breakpoint at or below the foot's widest section,
 * measured from the foot's top. The loft's sections land exactly here, so a
 * vertex-level comparison at these depths is comparing the profile itself
 * rather than the tessellation. Everything a baseplate touches is in this
 * range: only the top 0.25mm, above the widest section, is relieved.
 */
const PROFILE_Z = [-0.25, -2.4, -4.2, -5];

/** A single L foot on a cell centred at the origin, hugging its +X/+Y corner. */
const CORNER_L: FootPlacement = {
  shape: 'L',
  x: PITCH / 2,
  y: PITCH / 2,
  dirX: 1,
  dirY: 1,
  interiorX: false,
  interiorY: false,
  cellW: PITCH,
  cellD: PITCH,
};

function feetOf(over: Partial<DetachableFeetOptions> = {}): DetachableFeetGeometry {
  return buildDetachableFeet({
    placements: [CORNER_L],
    armMm: ARM,
    pinDiameterMm: PIN,
    pinHoleDiameterMm: DETACHABLE_PIN_HOLE_DIAMETER_MM,
    floorThicknessMm: FLOOR,
    forExport: true,
    ...over,
  });
}

/**
 * Z of the interior floor surface, probed at the bin's centre — not `minZ`, and
 * not the underside: below a 1mm wall the body reaches further down, so only the
 * floor's TOP is where the arithmetic says.
 */
function interiorFloorZ(m: MeshData): number {
  const { minZ, maxZ } = boundingBox(m.vertices);
  let inFloor = false;
  for (let z = minZ; z < maxZ; z += 0.05) {
    const solid = isSolidThrough(m, 0, 0, z, z + 0.04);
    if (solid) inFloor = true;
    else if (inFloor) return z;
  }
  return maxZ;
}

/** Extreme coordinate on one axis among vertices sitting at `z`. */
function extremeAt(m: MeshData, z: number, axis: 0 | 1): number {
  let best = -Infinity;
  for (let i = 0; i < m.vertices.length; i += 3) {
    if (Math.abs(m.vertices[i + 2] - z) > 1e-4) continue;
    best = Math.max(best, m.vertices[i + axis]);
  }
  return best;
}

describe('detachable foot geometry', () => {
  it('reproduces the integral foot profile exactly below the mating rim', () => {
    const { feet, pinHoles } = feetOf();
    const full = buildSingleCellSocket(PITCH - CLEARANCE, PITCH - CLEARANCE);
    try {
      const footMesh = meshOf(feet[0]);
      const fullMesh = meshOf(full);
      for (const z of PROFILE_Z) {
        // The outer faces this foot keeps are its +X and +Y ones.
        expect(extremeAt(footMesh, z, 0)).toBeCloseTo(extremeAt(fullMesh, z, 0), 6);
        expect(extremeAt(footMesh, z, 1)).toBeCloseTo(extremeAt(fullMesh, z, 1), 6);
      }
    } finally {
      feet.forEach((f) => f.delete());
      pinHoles?.delete();
      full.delete();
    }
  });

  it('sets the mating face back from the rim that curls', () => {
    const { feet, pinHoles } = feetOf();
    const full = buildSingleCellSocket(PITCH - CLEARANCE, PITCH - CLEARANCE);
    try {
      const footMesh = meshOf(feet[0]);
      const fullMesh = meshOf(full);
      for (const axis of [0, 1] as const) {
        const integral = extremeAt(fullMesh, 0, axis);
        // The face the bin sits on, inset by the relief.
        expect(extremeAt(footMesh, 0, axis)).toBeCloseTo(integral - MATING_RIM_RELIEF_MM, 6);
        // ...while the widest section is untouched, which is what the relief
        // landing on the profile's own breakpoint buys: a relief that narrowed
        // the whole foot would be one that loosened it in a baseplate.
        expect(extremeAt(footMesh, -0.25, axis)).toBeCloseTo(integral, 6);
      }
    } finally {
      feet.forEach((f) => f.delete());
      pinHoles?.delete();
      full.delete();
    }
  });

  it('is one closed solid once its pins are on', () => {
    const { feet, pinHoles } = feetOf();
    try {
      const stats = meshTopologyStats(meshOf(feet[0]));
      expect(stats.boundaryEdges).toBe(0);
      expect(stats.nonManifoldEdges).toBe(0);
    } finally {
      feet.forEach((f) => f.delete());
      pinHoles?.delete();
    }
  });

  it('stops its pins short of breaking through the floor', () => {
    const { feet, pinHoles } = feetOf();
    try {
      const box = boundingBox(meshOf(feet[0]).vertices);
      // Top of the pins, not of the foot: the foot's own top face is Z=0. The
      // pin reaches the engagement depth and stops, leaving the membrane that
      // keeps the interior floor unbroken.
      expect(box.maxZ).toBeCloseTo(FLOOR - MEMBRANE, 4);
      expect(box.maxZ).toBeLessThan(FLOOR);
      expect(box.minZ).toBeCloseTo(-5, 4);
    } finally {
      feet.forEach((f) => f.delete());
      pinHoles?.delete();
    }
  });

  /**
   * The one dimension every other check here is blind to: a pin wider than its
   * hole is still a closed solid of the right height, with its holes in place.
   */
  it('never exceeds its stated diameter anywhere along a pin', () => {
    const { feet, pinHoles } = feetOf();
    try {
      const m = meshOf(feet[0]);
      const pins = footPinPositions(CORNER_L, ARM, PIN);
      // Above the foot's top face is pin territory alone.
      let widest = 0;
      for (let i = 0; i < m.vertices.length; i += 3) {
        if (m.vertices[i + 2] <= 1e-6) continue;
        let nearest = Infinity;
        for (const pin of pins) {
          nearest = Math.min(nearest, Math.hypot(m.vertices[i] - pin.x, m.vertices[i + 1] - pin.y));
        }
        widest = Math.max(widest, nearest);
      }
      expect(widest * 2).toBeLessThanOrEqual(PIN + 1e-4);
      // And reaches it: the bound alone would pass an undersized pin.
      expect(widest * 2).toBeCloseTo(PIN, 3);
    } finally {
      feet.forEach((f) => f.delete());
      pinHoles?.delete();
    }
  });

  /**
   * The shaft holds its stated diameter for its whole length, rather than
   * dipping between crests. A ridged pin passes every other check here — it is
   * closed, the right height, and never wider than stated — while presenting
   * the slicer with a diameter that changes every layer, which is what made the
   * printed pin measure 2.0mm against a 2.8mm model.
   */
  it('holds the full pin diameter all the way up the shaft', () => {
    // The deep floor, so the shaft is long enough for a column probe to say
    // something: at the default 1.2mm floor a pin is 0.8mm tall in total.
    const { feet, pinHoles } = feetOf({ floorThicknessMm: 2.4 });
    try {
      const m = meshOf(feet[0]);
      const [pin] = footPinPositions(CORNER_L, ARM, PIN);
      const shaftTop = 2.4 - MEMBRANE - DETACHABLE_PIN_LEAD_IN_MM;
      // Just inside the pin's own surface: solid for the shaft's whole length
      // on a cylinder, interrupted at every valley on a ridged one.
      const inside = PIN / 2 - 0.02;
      expect(isSolidThrough(m, pin.x + inside, pin.y, 0.02, shaftTop - 0.02)).toBe(true);
      // Just outside it, so the probe above cannot be passing on a fat pin.
      expect(isSolidThrough(m, pin.x + PIN / 2 + 0.02, pin.y, 0.02, shaftTop - 0.02)).toBe(false);
    } finally {
      feet.forEach((f) => f.delete());
      pinHoles?.delete();
    }
  });

  it('tapers each pin tip so three pins can enter three holes at once', () => {
    const { feet, pinHoles } = feetOf();
    try {
      const m = meshOf(feet[0]);
      const pins = footPinPositions(CORNER_L, ARM, PIN);
      const { maxZ } = boundingBox(m.vertices);
      let tipRadius = 0;
      for (let i = 0; i < m.vertices.length; i += 3) {
        if (Math.abs(m.vertices[i + 2] - maxZ) > 1e-4) continue;
        for (const pin of pins) {
          const d = Math.hypot(m.vertices[i] - pin.x, m.vertices[i + 1] - pin.y);
          if (d < PIN) tipRadius = Math.max(tipRadius, d);
        }
      }
      expect(tipRadius).toBeGreaterThan(0);
      expect(tipRadius * 2).toBeLessThan(PIN - DETACHABLE_PIN_LEAD_IN_MM);
    } finally {
      feet.forEach((f) => f.delete());
      pinHoles?.delete();
    }
  });

  it('takes a thicker floor as a longer pin, so the fit never depends on wall thickness', () => {
    const thick = feetOf({ floorThicknessMm: 2.4 });
    try {
      expect(boundingBox(meshOf(thick.feet[0]).vertices).maxZ).toBeCloseTo(2.4 - MEMBRANE, 4);
    } finally {
      thick.feet.forEach((f) => f.delete());
      thick.pinHoles?.delete();
    }
  });

  it('opens its magnet pocket at the underside, where the magnet goes in', () => {
    const withMagnet = feetOf({
      magnet: { diameterMm: MAGNET_D, depthMm: MAGNET_DEPTH, positions: [[13, 13]] },
    });
    try {
      const m = meshOf(withMagnet.feet[0]);
      const { minZ } = boundingBox(m.vertices);
      // Nothing solid in the pocket's band...
      expect(isSolidThrough(m, 13, 13, minZ + 0.05, minZ + MAGNET_DEPTH - 0.05)).toBe(false);
      // ...and solid again above it, so the pocket is blind rather than a hole.
      expect(isSolidThrough(m, 13, 13, minZ + MAGNET_DEPTH + 0.1, minZ + 4)).toBe(true);
    } finally {
      withMagnet.feet.forEach((f) => f.delete());
      withMagnet.pinHoles?.delete();
    }
  });

  it('keeps its magnet pockets on an edge bar crossing an interior station', () => {
    // The 4x2 case: a mid-run edge bar has dirY = 1, dirX = 0, interiorX true.
    // Its clip spans the FULL cell in X (`edgeY`), so the spec corners at
    // (±13, 13) are real material — a bound that shrank X to the arm's width
    // rejected both and shipped the foot with no pockets at all.
    const interiorEdgeBar: FootPlacement = {
      shape: 'bar',
      x: 0,
      y: PITCH / 2,
      dirX: 0,
      dirY: 1,
      interiorX: true,
      interiorY: false,
      cellW: PITCH,
      cellD: PITCH,
    };
    const withMagnet = feetOf({
      placements: [interiorEdgeBar],
      magnet: {
        diameterMm: MAGNET_D,
        depthMm: MAGNET_DEPTH,
        positions: [
          [-13, 13],
          [13, 13],
        ],
      },
    });
    try {
      const m = meshOf(withMagnet.feet[0]);
      const { minZ } = boundingBox(m.vertices);
      for (const x of [-13, 13]) {
        expect(
          isSolidThrough(m, x, 13, minZ + 0.05, minZ + MAGNET_DEPTH - 0.05),
          `pocket at x=${x}`
        ).toBe(false);
      }
    } finally {
      withMagnet.feet.forEach((f) => f.delete());
      withMagnet.pinHoles?.delete();
    }
  });

  it('leaves a plain foot solid where a magnet pocket would be', () => {
    const { feet, pinHoles } = feetOf();
    try {
      const m = meshOf(feet[0]);
      const { minZ } = boundingBox(m.vertices);
      expect(isSolidThrough(m, 13, 13, minZ + 0.05, minZ + MAGNET_DEPTH)).toBe(true);
    } finally {
      feet.forEach((f) => f.delete());
      pinHoles?.delete();
    }
  });

  it('punches its floor holes at the pin positions and nowhere else', () => {
    const { feet, pinHoles } = feetOf();
    try {
      if (!pinHoles) throw new Error('expected a hole tool');
      const tool = meshOf(pinHoles);
      const box = boundingBox(tool.vertices);
      // Opens below the floor and stops short of its top face: the holes are
      // blind, so the interior surface is never broken.
      expect(box.minZ).toBeLessThan(0);
      expect(box.maxZ).toBeCloseTo(FLOOR - MEMBRANE, 4);
      expect(box.maxZ).toBeLessThan(FLOOR);

      for (const pin of footPinPositions(CORNER_L, ARM, PIN)) {
        expect(isSolidThrough(tool, pin.x, pin.y, 0.1, FLOOR - MEMBRANE - 0.1)).toBe(true);
      }
      // A point a full pin diameter off any of them is not drilled.
      expect(isSolidThrough(tool, CORNER_L.x, CORNER_L.y, 0.1, FLOOR - 0.1)).toBe(false);
    } finally {
      feet.forEach((f) => f.delete());
      pinHoles?.delete();
    }
  });

  it('builds one solid per placement', () => {
    const bar: FootPlacement = {
      shape: 'bar',
      x: 0,
      y: PITCH / 2,
      dirX: 0,
      dirY: 1,
      interiorX: false,
      interiorY: false,
      cellW: PITCH,
      cellD: PITCH,
    };
    const { feet, pinHoles } = feetOf({ placements: [CORNER_L, bar] });
    try {
      expect(feet).toHaveLength(2);
      for (const f of feet) expect(meshTopologyStats(meshOf(f)).boundaryEdges).toBe(0);
    } finally {
      feet.forEach((f) => f.delete());
      pinHoles?.delete();
    }
  });
});

/**
 * The body side, end to end. A detachable bin's printed part is the same body
 * an integral bin has, minus the socket and plus the pin holes — so the checks
 * are all DELTAS against the integral bin rather than absolute figures, which
 * would only restate the arithmetic that produced them.
 */
describe('a bin built with detachable feet', () => {
  let generateBin: (p: BinParams, cb: undefined, forExport: boolean) => MeshData;

  beforeAll(async () => {
    generateBin = (await import('./binOrchestrator')).generateBin;
  }, 60000);

  const binParams = (
    feet: 'integral' | 'detachable',
    over: Partial<BinParams> = {}
  ): BinParams => ({
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 3,
    ...over,
    base: { ...DEFAULT_BIN_PARAMS.base, feet, ...(over.base ?? {}) },
  });

  const bin = (feet: 'integral' | 'detachable', over: Partial<BinParams> = {}): MeshData =>
    generateBin(binParams(feet, over), undefined, true);

  it('prints exactly one socket shorter than the same bin with integral feet', () => {
    const integral = boundingBox(bin('integral').vertices);
    const detachable = boundingBox(bin('detachable').vertices);
    expect(integral.maxZ - integral.minZ - (detachable.maxZ - detachable.minZ)).toBeCloseTo(5, 3);
    // Same footprint: the feet come off the bottom, not the sides.
    expect(detachable.maxX - detachable.minX).toBeCloseTo(integral.maxX - integral.minX, 4);
  });

  it('has a flat underside where the integral bin has feet', () => {
    const m = bin('detachable');
    const { minZ } = boundingBox(m.vertices);
    // Solid straight through the floor at a point that would be inside a foot.
    expect(isSolidThrough(m, 0, 0, minZ + 0.05, minZ + 1.1)).toBe(true);
    // ...and the socket band simply is not there: nothing below the floor.
    expect(isSolidThrough(m, 0, 0, minZ - 1, minZ - 0.1)).toBe(false);
  });

  it('leaves the interior floor unbroken above every pin', () => {
    const m = bin('detachable');
    const { minZ } = boundingBox(m.vertices);
    const resolved = resolveDetachableFeet(binParams('detachable'));
    expect(resolved.placements.length).toBe(4);
    const floor = binFloorMm(FLOOR);

    for (const foot of resolved.placements) {
      for (const pin of footPinPositions(foot, resolved.armMm, resolved.pinDiameterMm)) {
        // The recess is open at the underside...
        expect(isSolidThrough(m, pin.x, pin.y, minZ + 0.05, minZ + 0.3)).toBe(false);
        // ...and the membrane above it is solid, so nothing reaches the
        // interior — where the scoop ramp, dividers and floor pattern live.
        expect(isSolidThrough(m, pin.x, pin.y, minZ + floor - MEMBRANE + 0.05, minZ + floor)).toBe(
          true
        );
      }
    }
  });

  it('spends the thicker floor on the pin, not on the membrane', () => {
    const m = bin('detachable');
    const { minZ } = boundingBox(m.vertices);
    const resolved = resolveDetachableFeet(binParams('detachable'));
    const floor = binFloorMm(FLOOR);
    expect(floor).toBeGreaterThan(FLOOR);

    const pin = footPinPositions(resolved.placements[0], resolved.armMm, resolved.pinDiameterMm)[0];
    // Open to the membrane, so the extra floor is engagement not dead material.
    expect(isSolidThrough(m, pin.x, pin.y, minZ + 0.05, minZ + floor - MEMBRANE - 0.05)).toBe(
      false
    );
    expect(detachablePinEngagementMm(floor)).toBeGreaterThanOrEqual(
      DETACHABLE_PIN_TARGET_ENGAGEMENT_MM
    );
  });
});

/**
 * Whether a foot actually drops into a pocket, measured rather than argued.
 *
 * A foot that lands on the ridge between two pockets is a perfectly valid
 * solid: watertight, right triangle count, right bounding box. The only way to
 * see it is to mate the parts and let them fall, so this drops the FEET onto a
 * generated plate and reports the depth they reach — ~5mm seated against ~0
 * perched.
 */
describe('detachable feet seating in a baseplate', () => {
  let generateFeet: (p: BinParams) => MeshData | null;
  let plate: MeshData;

  beforeAll(async () => {
    generateFeet = (await import('./detachableFeetOrchestrator')).generateDetachableFeetMesh;
    const generateBaseplate = (await import('./baseplateGenerator')).generateBaseplate;
    plate = generateBaseplate(
      {
        width: 5,
        depth: 5,
        gridUnitMm: 42,
        magnetHoles: false,
        magnetDiameter: 6.5,
        magnetDepth: 2.4,
        paddingLeft: 0,
        paddingRight: 0,
        paddingFront: 0,
        paddingBack: 0,
        fractionalEdgeX: 'end',
        fractionalEdgeY: 'end',
        lightweight: false,
      },
      () => {},
      false
    );
  }, 120000);

  const feetFor = (lattice: FootLattice): MeshData => {
    const m = generateFeet({
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 3,
      height: 3,
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        feet: 'detachable',
        footLatticeX: lattice,
        footLatticeY: lattice,
      },
    });
    if (!m) throw new Error('expected feet');
    return m;
  };

  /** Pocket depth: feet that drop all the way reach this. */
  const POCKET_DEPTH = 5;
  const HALF_UNIT = 21;

  it('seats an on-grid bin', () => {
    expect(seatDepth(feetFor('grid'), plate, { dx: 0, dy: 0 }).mm).toBeGreaterThan(
      POCKET_DEPTH - 1
    );
  });

  it('perches when the bin is half-offset and the lattice was not told', () => {
    // The discriminating case: same feet, moved half a unit, now straddling
    // ridges. Without this the seated assertion above would also pass on feet
    // that seat nowhere.
    expect(seatDepth(feetFor('grid'), plate, { dx: HALF_UNIT, dy: HALF_UNIT }).mm).toBeLessThan(1);
  });

  it('seats a half-offset bin once the lattice shifts its anchors', () => {
    expect(seatDepth(feetFor('half'), plate, { dx: HALF_UNIT, dy: HALF_UNIT }).mm).toBeGreaterThan(
      POCKET_DEPTH - 1
    );
  });
});

/**
 * A wall too thin for a pin used to fail the WHOLE generation: the builder
 * throws, and the shell stage does not catch. Three of the selectable wall
 * thicknesses are in that range, so this is the difference between an
 * unavailable toggle and a dead preview.
 */
describe('a floor too thin to hold a pin', () => {
  let generateBin: (p: BinParams, cb: undefined, forExport: boolean) => MeshData;

  beforeAll(async () => {
    generateBin = (await import('./binOrchestrator')).generateBin;
  }, 60000);

  it('clamps the pin and builds, rather than failing the generation', () => {
    // A throw here would have to be mirrored by every caller that asks whether
    // a bin has feet. The geometry always builds; the panel is what refuses.
    for (const wallThickness of [0.4, 0.6, 0.8]) {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 2,
        height: 3,
        wallThickness,
        base: { ...DEFAULT_BIN_PARAMS.base, feet: 'detachable' },
      };
      const mesh = generateBin(params, undefined, true);
      expect(mesh.triangleCount).toBeGreaterThan(0);
      // Still the detachable body: one socket shorter than its nominal height.
      const { minZ, maxZ } = boundingBox(mesh.vertices);
      expect(maxZ - minZ).toBeLessThan(21);
    }
  });

  it('leaves a membrane at every thickness, so the interior never opens', () => {
    for (const wallThickness of [0.4, 0.8, 1.2, 2.4]) {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 2,
        height: 3,
        wallThickness,
        base: { ...DEFAULT_BIN_PARAMS.base, feet: 'detachable' },
      };
      const m = generateBin(params, undefined, true);
      const resolved = resolveDetachableFeet(params);
      const top = interiorFloorZ(m);
      for (const foot of resolved.placements) {
        for (const pin of footPinPositions(foot, resolved.armMm, resolved.pinDiameterMm)) {
          // The WHOLE membrane, not a sliver at the very top: a probe that thin
          // passes while a hole eats almost all of the band it is meant to
          // protect, which is the invariant the blind holes exist for.
          expect(isSolidThrough(m, pin.x, pin.y, top - MEMBRANE, top)).toBe(true);
          const reach = detachablePinEngagementMm(binFloorMm(wallThickness));
          expect(
            isSolidThrough(m, pin.x, pin.y, top - MEMBRANE - reach + 0.1, top - MEMBRANE - 0.1)
          ).toBe(false);
        }
      }
    }
  });
});

/**
 * A screw fastens the bin down THROUGH its foot, so unlike the magnet pocket
 * its bore cannot be blind: it has to leave the foot and carry on through the
 * floor, or it fastens nothing. The integral path cuts these in
 * `buildBaseSocket`, which the detachable branch skips entirely — so without
 * this the screw controls stay live and produce a bin with no screw holes.
 */
describe('screw bases with detachable feet', () => {
  let generateBin: (p: BinParams, cb: undefined, forExport: boolean) => MeshData;

  beforeAll(async () => {
    generateBin = (await import('./binOrchestrator')).generateBin;
  }, 60000);

  const screwed: BinParams = {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 3,
    base: { ...DEFAULT_BIN_PARAMS.base, style: 'screw', feet: 'detachable' },
  };

  /** Corners with a hole clean through the floor. */
  const boredCount = (params: BinParams): number => {
    const m = generateBin(params, undefined, true);
    const { minZ } = boundingBox(m.vertices);
    const resolved = resolveDetachableFeet(screwed);
    if (!resolved.screw) throw new Error('expected screw positions');
    return resolved.screw.positions.filter(
      ([x, y]) => !isSolidThrough(m, x, y, minZ + 0.05, minZ + 1.15)
    ).length;
  };

  it('bores through the floor once per foot, and only where a foot sits', () => {
    // A candidate corner with no foot under it must NOT be bored: the screw
    // would pass through the bin and out into open air.
    const resolved = resolveDetachableFeet(screwed);
    expect(boredCount(screwed)).toBe(resolved.placements.length);
    expect(resolved.screw?.positions.length).toBeGreaterThan(resolved.placements.length);
  });

  it('leaves every corner solid without screws', () => {
    const plain = { ...screwed, base: { ...screwed.base, style: 'standard' as const } };
    expect(boredCount(plain)).toBe(0);
  });
});
