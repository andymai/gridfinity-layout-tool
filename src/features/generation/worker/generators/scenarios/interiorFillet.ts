/**
 * Interior fillet (#4382): every compartment's wall-to-floor edges rounded,
 * its vertical corners rounded to at least the same radius.
 *
 * A missing fillet and a present one have the same bounding box and both
 * export watertight, so each case measures the rounding itself: the floor's
 * height a fraction of a radius in from a wall (a quarter circle there rises
 * by a known amount), and the volume it adds over the same bin without it.
 * The export solid must keep the sharp bin's Euler characteristic (2 for one
 * closed shell, 0 for a ring), because the fillet fuses in as a separate solid
 * per compartment and a fuse that kept them as overlapping shells would pass
 * every other check.
 */
import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import {
  boundingBox,
  columnCrossings,
  isSolidThrough,
  meshTopologyStats,
  meshVolume,
} from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { deriveDimensions } from '../pipeline/context';

/** Height of the solid surface at `(x, y)` within reach of the floor. */
function floorSurfaceAt(mesh: MeshData, x: number, y: number, floorTop: number, reach: number) {
  const near = columnCrossings(mesh, x, y).filter(
    (z) => z > floorTop - 0.05 && z < floorTop + reach + 0.5
  );
  return Math.max(...near);
}

/** How far a quarter circle of radius `r` stands above its floor `d` in from its wall. */
function quarterRise(r: number, d: number): number {
  return r - Math.sqrt(r * r - (r - d) * (r - d));
}

interface Cavity {
  readonly floorTop: number;
  /** Inner face of the left wall and the front wall, mesh frame. */
  readonly left: number;
  readonly front: number;
  readonly innerW: number;
  readonly innerD: number;
}

function cavity(params: BinParams): Cavity {
  const dim = deriveDimensions(params, true);
  return {
    floorTop: dim.baseOffsetZ + dim.floorThickness,
    left: dim.innerOffsetX - dim.innerW / 2,
    front: dim.innerOffsetY - dim.innerD / 2,
    innerW: dim.innerW,
    innerD: dim.innerD,
  };
}

function expectClosedManifold(mesh: MeshData): void {
  const { boundaryEdges, nonManifoldEdges } = meshTopologyStats(mesh);
  expect(boundaryEdges).toBe(0);
  expect(nonManifoldEdges).toBe(0);
}

/**
 * The front wall's floor junction, probed a quarter radius in, a quarter of the
 * way along: in the first compartment of a two-column grid, clear of a corner.
 */
function expectRoundedFrontJunction(mesh: MeshData, params: BinParams, r: number): void {
  const c = cavity(params);
  const d = r / 4;
  const z = floorSurfaceAt(mesh, c.left + c.innerW / 4, c.front + d, c.floorTop, r);
  expect(z - c.floorTop).toBeCloseTo(quarterRise(r, d), 1);
}

function sharpSibling(params: Partial<BinParams>): Partial<BinParams> {
  const { interiorFilletMm: _r, ...rest } = params;
  return rest;
}

/** Adds material, never reaches outside the bin, and stays one solid. */
function filletCase(
  name: string,
  params: Partial<BinParams>,
  extra?: (mesh: MeshData, full: BinParams) => void,
  addsMaterial = true
): ScenarioCase {
  return defineScenario('interior fillet #4382', name, {
    assert: 'structural',
    forExport: true,
    params,
    customAssert: (mesh, full) => {
      expectClosedManifold(mesh);
      extra?.(mesh, full);
    },
    compareWith: {
      params: sharpSibling(params),
      forExport: true,
      assert: (rounded, sharp) => {
        expect(meshTopologyStats(rounded).eulerCharacteristic).toBe(
          meshTopologyStats(sharp).eulerCharacteristic
        );
        if (addsMaterial) expect(meshVolume(rounded)).toBeGreaterThan(meshVolume(sharp) + 1);
        else expect(Math.abs(meshVolume(rounded) - meshVolume(sharp))).toBeLessThan(1);
        const a = boundingBox(rounded.vertices);
        const b = boundingBox(sharp.vertices);
        for (const k of ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ'] as const) {
          expect(a[k]).toBeCloseTo(b[k], 2);
        }
      },
    },
  });
}

const TWO_BY_TWO = { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 };

/**
 * What a request at the 2.55mm corner radius builds on the floor: the floor
 * radius stays 0.1 under the corner's, so each corner closes as a torus.
 */
const FLOOR_AT_CORNER_RADIUS = 2.45;

export const interiorFillet: ScenarioCase[] = [
  filletCase(
    'single cavity at the corner radius',
    { width: 1, depth: 1, height: 3, interiorFilletMm: 2.55 },
    (mesh, params) => expectRoundedFrontJunction(mesh, params, FLOOR_AT_CORNER_RADIUS)
  ),
  filletCase(
    'a small radius under the corner radius blends through a torus',
    { width: 2, depth: 1, height: 3, interiorFilletMm: 1 },
    (mesh, params) => expectRoundedFrontJunction(mesh, params, 1)
  ),
  filletCase(
    'a 2x2 grid rounds every divider junction corner',
    { width: 2, depth: 2, height: 4, interiorFilletMm: 2.55, compartments: TWO_BY_TWO },
    (mesh, params) => {
      expectRoundedFrontJunction(mesh, params, FLOOR_AT_CORNER_RADIUS);
      // Just inside the divider junction nearest the bin's centre, on its
      // diagonal. Sharp, that column is open air above the floor; with the
      // corner rounded it runs through solid most of the way up the dividers.
      const c = cavity(params);
      const half = params.compartments.thickness / 2;
      const inset = 0.6;
      const x = c.left + c.innerW / 2 - half - inset;
      const y = c.front + c.innerD / 2 - half - inset;
      expect(isSolidThrough(mesh, x, y, c.floorTop, c.floorTop + 10)).toBe(true);
    }
  ),
  filletCase(
    'short dividers take the additive path and round up to their tops',
    {
      width: 2,
      depth: 2,
      height: 5,
      interiorFilletMm: 2,
      compartments: { ...TWO_BY_TWO, dividerHeight: 15 },
    },
    (mesh, params) => expectRoundedFrontJunction(mesh, params, 2)
  ),
  filletCase('a merged L-shaped compartment keeps its jutting corner sharp', {
    width: 2,
    depth: 2,
    height: 4,
    interiorFilletMm: 3,
    compartments: { cols: 2, rows: 2, cells: [0, 0, 0, 1], thickness: 1.2 },
  }),
  filletCase('a tilted divider rounds along its angle', {
    width: 2,
    depth: 1,
    height: 4,
    interiorFilletMm: 2.55,
    compartments: {
      cols: 2,
      rows: 1,
      cells: [0, 1],
      thickness: 1.2,
      dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: -6, offsetEnd: 6 }],
    },
  }),
  filletCase('a leaning divider rounds along its lean', {
    width: 2,
    depth: 1,
    height: 5,
    interiorFilletMm: 2.55,
    compartments: {
      cols: 2,
      rows: 1,
      cells: [0, 1],
      thickness: 1.2,
      dividerOverrides: [
        { compartmentA: 0, compartmentB: 1, offsetStart: 0, offsetEnd: 0, rakeDeg: 12 },
      ],
    },
  }),
  filletCase(
    'a bowl radius clamps to each compartment',
    {
      width: 1,
      depth: 1,
      height: 4,
      interiorFilletMm: 15,
      compartments: TWO_BY_TWO,
    },
    (mesh, params) => {
      // Each compartment is under 20mm across, so the fillet clamps to just
      // under half of that: well past the corner radius, short of 15.
      const c = cavity(params);
      const z = floorSurfaceAt(mesh, c.left + 3, c.front + c.innerD / 4, c.floorTop, 15);
      expect(z - c.floorTop).toBeGreaterThan(2);
    }
  ),
  filletCase(
    'a raised compartment floor carries its own fillet',
    {
      width: 2,
      depth: 1,
      height: 6,
      interiorFilletMm: 2,
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2, floorRaises: [8, null] },
    },
    (mesh, params) => {
      const c = cavity(params);
      const raised = c.floorTop + 8;
      const z = floorSurfaceAt(mesh, c.left + c.innerW / 4, c.front + 0.5, raised, 2);
      expect(z - raised).toBeCloseTo(quarterRise(2, 0.5), 1);
    }
  ),
  filletCase('a finger scoop fuses over the fillet', {
    width: 2,
    depth: 2,
    height: 4,
    interiorFilletMm: 2.55,
    scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 'auto' as const },
  }),
  filletCase(
    'a wall cutout down to the floor leaves no curb in the doorway',
    {
      width: 2,
      depth: 1,
      height: 4,
      interiorFilletMm: 3,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        shape: 'u-shape',
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 50, depth: 100 },
      },
    },
    (mesh, params) => {
      // Mid-doorway, a quarter radius in from where the wall was: a curb would
      // stand there. The floor (or the cut's own bottom) is all that remains.
      const c = cavity(params);
      const z = floorSurfaceAt(mesh, c.left + c.innerW / 2, c.front + 0.75, c.floorTop, 3);
      expect(z - c.floorTop).toBeLessThan(0.05);
    }
  ),
  filletCase('an asymmetric overhang moves the fillet with the cavity', {
    width: 2,
    depth: 1,
    height: 3,
    interiorFilletMm: 2.55,
    overhang: { left: 4, right: 0, front: 0, back: 2, feet: false },
  }),
  // A tapered band already meets the floor at a shallow angle, and the fillet
  // drawn on the rim-level wall line sits mostly inside it. The claim is that
  // the taper clip keeps it there: nothing pokes out of the leaning outer skin.
  filletCase('a tapered bottom band keeps the fillet inside the leaning wall', {
    width: 2,
    depth: 1,
    height: 4,
    interiorFilletMm: 2.55,
    overhang: {
      left: 3,
      right: 3,
      front: 3,
      back: 3,
      feet: false,
      taper: {
        enabled: true,
        profile: 'chamfer',
        bandHeight: 6,
        left: 3,
        right: 3,
        front: 3,
        back: 3,
      },
    },
  }),
  filletCase(
    'a compartment wrapped round another rounds along both its boundaries',
    {
      width: 3,
      depth: 3,
      height: 4,
      interiorFilletMm: 2.5,
      compartments: { cols: 3, rows: 3, cells: [0, 0, 0, 0, 1, 0, 0, 0, 0], thickness: 1.2 },
    },
    (mesh, params) => {
      const c = cavity(params);
      const cell = c.innerW / 3;
      const centreX = c.left + c.innerW / 2;
      const centreY = c.front + c.innerD / 2;
      // The middle of the inner compartment is open floor, not filled.
      expect(floorSurfaceAt(mesh, centreX, centreY, c.floorTop, 3) - c.floorTop).toBeLessThan(0.05);
      // A quarter radius out from the divider round it, on the ring's side,
      // the ring's floor rises into its fillet.
      const face = c.front + cell - 0.6;
      const r = 2.5;
      const near = floorSurfaceAt(mesh, centreX, face - r / 4, c.floorTop, r + 1);
      expect(near - c.floorTop).toBeGreaterThan(quarterRise(r, r / 4) / 2);
    }
  ),
  filletCase('a half-grid bin rounds like a whole one', {
    width: 1.5,
    depth: 1,
    height: 3,
    interiorFilletMm: 2.55,
  }),
  filletCase('a custom-shape bin rounds its outline and keeps its notch corner', {
    width: 2,
    depth: 2,
    height: 3,
    interiorFilletMm: 2.55,
    cellMask: { cols: 4, rows: 4, cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0] },
  }),
  filletCase(
    'a ring-shaped custom bin keeps its hole open',
    {
      width: 3,
      depth: 3,
      height: 3,
      interiorFilletMm: 2.55,
      cellMask: {
        cols: 6,
        rows: 6,
        cells: [
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1,
        ],
      },
    },
    (mesh, params) => {
      // Straight down through the hole: nothing at all, not even a skin.
      const dim = deriveDimensions(params, true);
      expect(columnCrossings(mesh, dim.innerOffsetX, dim.innerOffsetY)).toHaveLength(0);
    }
  ),
  filletCase('a custom shape on a non-square pitch stays inside its walls', {
    width: 2,
    depth: 2,
    height: 3,
    gridUnitMmY: 36,
    interiorFilletMm: 2.55,
    cellMask: { cols: 4, rows: 4, cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0] },
  }),
  filletCase('no stacking lip', {
    width: 1,
    depth: 1,
    height: 3,
    interiorFilletMm: 2.55,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
  }),
];

/**
 * The fillet climbing a finger scoop (#4382): where a ramp meets an unscooped
 * side wall, the floor fillet carries on up the ramp and the corner above it.
 * Measured a quarter radius in from the side wall, over the ramp, against a
 * point well clear of the wall at the same depth: the ramp alone is flat across
 * its width, so any rise there is the fillet riding it. `wallY` is the face the
 * ramp stands against, the front wall unless given.
 */
function expectRampSideRounded(mesh: MeshData, params: BinParams, wallY?: number): void {
  const c = cavity(params);
  const r = params.interiorFilletMm ?? 0;
  const y = (wallY ?? c.front) + 3;
  const reach = c.innerD;
  const atSide = floorSurfaceAt(mesh, c.left + r / 4, y, c.floorTop, reach);
  const clear = floorSurfaceAt(mesh, c.left + r + 3, y, c.floorTop, reach);
  expect(atSide - clear).toBeGreaterThan(quarterRise(r, r / 4) / 3);
}

/** The back face of a two-row grid's divider, which the back row's ramps stand on. */
function dividerFace(params: BinParams): number {
  const c = cavity(params);
  return c.front + c.innerD / 2 + params.compartments.thickness / 2;
}

function expectBothRowsRounded(mesh: MeshData, params: BinParams): void {
  expectRampSideRounded(mesh, params);
  expectRampSideRounded(mesh, params, dividerFace(params));
}

const FRONT_SCOOP = { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 'auto' as const };

export const interiorFilletScoops: ScenarioCase[] = [
  filletCase(
    'the fillet climbs a front scoop along both side walls',
    { width: 1, depth: 1, height: 4, interiorFilletMm: 2.45, scoop: FRONT_SCOOP },
    expectRampSideRounded
  ),
  filletCase(
    'without a stacking lip the ramp meets the wall directly',
    {
      width: 1,
      depth: 1,
      height: 4,
      interiorFilletMm: 2.45,
      scoop: FRONT_SCOOP,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
    expectRampSideRounded
  ),
  filletCase(
    'a small radius climbs the ramp',
    { width: 1, depth: 1, height: 4, interiorFilletMm: 0.8, scoop: FRONT_SCOOP },
    expectRampSideRounded
  ),
  filletCase(
    'a large radius climbs the ramp',
    { width: 1, depth: 1, height: 4, interiorFilletMm: 6, scoop: FRONT_SCOOP },
    expectRampSideRounded
  ),
  filletCase(
    "a thick wall's narrow lip filler still carries the fillet up the ramp",
    {
      width: 1,
      depth: 1,
      height: 4,
      wallThickness: 2.4,
      interiorFilletMm: 1.3,
      scoop: FRONT_SCOOP,
    },
    expectRampSideRounded
  ),
  filletCase(
    'scoops on opposite walls each blend into both side walls',
    {
      width: 1,
      depth: 1,
      height: 4,
      interiorFilletMm: 2.45,
      scoop: { ...FRONT_SCOOP, sides: ['front', 'back'] },
    },
    expectRampSideRounded
  ),
  filletCase('scoops on adjacent walls keep the corner between them rounded', {
    width: 1,
    depth: 1,
    height: 4,
    interiorFilletMm: 2.45,
    scoop: { ...FRONT_SCOOP, sides: ['front', 'left'] },
  }),
  filletCase(
    'scoops on all four walls leave nothing to climb and still build',
    {
      width: 1,
      depth: 1,
      height: 4,
      interiorFilletMm: 2.45,
      scoop: { ...FRONT_SCOOP, sides: ['front', 'back', 'left', 'right'] },
    },
    undefined,
    false
  ),
  filletCase(
    'a straight scoop blends along its bevel',
    {
      width: 1,
      depth: 1,
      height: 4,
      interiorFilletMm: 2.45,
      scoop: { ...FRONT_SCOOP, style: 'straight' },
    },
    expectRampSideRounded
  ),
  filletCase(
    'a custom-profile scoop blends along its ellipse',
    {
      width: 1,
      depth: 2,
      height: 5,
      interiorFilletMm: 2,
      scoop: { ...FRONT_SCOOP, radius: 18, run: 10 },
    },
    expectRampSideRounded
  ),
  filletCase(
    'every compartment of a 2x2 grid blends its own scoop',
    {
      width: 2,
      depth: 2,
      height: 4,
      interiorFilletMm: 2.45,
      scoop: FRONT_SCOOP,
      compartments: TWO_BY_TWO,
    },
    expectBothRowsRounded
  ),
  filletCase(
    'without a stacking lip every compartment of a 2x2 grid blends its own scoop',
    {
      width: 2,
      depth: 2,
      height: 4,
      interiorFilletMm: 2.45,
      scoop: FRONT_SCOOP,
      compartments: TWO_BY_TWO,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
    expectBothRowsRounded
  ),
  // A wall cutout trims the fillet around its doorway, which would notch a ramp
  // the fillet carried, so the scoop keeps its own ramp and the plain fillet.
  filletCase('a wall cutout keeps the scoop and the plain fillet apart', {
    width: 2,
    depth: 1,
    height: 4,
    interiorFilletMm: 2.45,
    scoop: FRONT_SCOOP,
    walls: {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      shape: 'u-shape',
      left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 50, depth: 60 },
    },
  }),
  // The arc on a leaning wall is drawn in chords, which the fillet cannot roll
  // along; the compartment keeps the plain floor and corner fillet instead.
  filletCase('a scoop on a tapered wall keeps the plain fillet', {
    width: 2,
    depth: 1,
    height: 4,
    interiorFilletMm: 2.45,
    scoop: FRONT_SCOOP,
    overhang: {
      left: 3,
      right: 3,
      front: 3,
      back: 3,
      feet: false,
      taper: {
        enabled: true,
        profile: 'chamfer',
        bandHeight: 6,
        left: 3,
        right: 3,
        front: 3,
        back: 3,
      },
    },
  }),
  filletCase('a scoop on a raised floor blends from its own floor', {
    width: 2,
    depth: 1,
    height: 6,
    interiorFilletMm: 2,
    scoop: FRONT_SCOOP,
    compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2, floorRaises: [8, null] },
  }),
];
