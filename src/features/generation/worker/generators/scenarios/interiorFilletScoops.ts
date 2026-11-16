/**
 * Interior fillet carried up finger scoops (#4382): where a ramp meets an
 * unscooped side wall, the floor fillet runs on up the ramp and the corner
 * above it. Built on the plain fillet's cases and probes.
 */
import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { defaultInteriorFilletMm } from '@/shared/utils/interiorFillet';
import { columnCrossings } from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { deriveDimensions } from '../pipeline/context';
import { planScoopRamps } from '../scoopRampPlan';
import { TWO_BY_TWO, cavity, filletCase, quarterRise } from './interiorFillet';

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
  const atSide = surfaceOverFloor(mesh, c.left + r / 4, y, c.floorTop);
  const clear = surfaceOverFloor(mesh, c.left + r + 3, y, c.floorTop);
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

/**
 * Horizontal edges running across the front ramp between its top and its foot.
 * A smooth arc has none. Drawn in chords it has one at every kink, the stack of
 * lines the preview outlines and a STEP export carries as separate flat faces.
 */
function frontRampFacetLines(mesh: MeshData, params: BinParams): number {
  const c = cavity(params);
  const dim = deriveDimensions(params, true);
  const ramp = planScoopRamps(
    params,
    dim.innerW,
    dim.innerD,
    dim.wallHeight,
    params.wallThickness,
    dim.floorThickness,
    () => 0,
    dim.overhang.taper
  ).find((plan) => plan.side === 'front' && plan.placement.isOuter);
  if (!ramp) throw new Error('no front ramp planned');
  const yLo = c.front + ramp.arcTop + 0.2;
  const yHi = c.front + ramp.floorStart + ramp.run - 0.2;
  const zLo = c.floorTop + 0.2;
  const zHi = c.floorTop + ramp.height - 0.2;
  const e = mesh.edgeVertices;
  let lines = 0;
  for (let i = 0; i + 5 < e.length; i += 6) {
    const across = Math.abs(e[i + 3] - e[i]) > c.innerW / 2;
    const level = Math.abs(e[i + 4] - e[i + 1]) < 0.01 && Math.abs(e[i + 5] - e[i + 2]) < 0.01;
    const y = e[i + 1];
    const z = e[i + 2];
    if (across && level && y > yLo && y < yHi && z > zLo && z < zHi) lines++;
  }
  return lines;
}

/**
 * Where the solid standing on the floor at `(x, y)` ends: the lowest surface
 * above the floor top, so a stacking lip overhead does not read as the ramp.
 */
function surfaceOverFloor(mesh: MeshData, x: number, y: number, floorTop: number): number {
  return Math.min(...columnCrossings(mesh, x, y).filter((z) => z > floorTop - 0.05));
}

/**
 * The front ramp's surface a quarter radius in from each side wall, where the
 * fillet rides it, and just off mid-width, at a few depths down its arc.
 */
function frontRampSection(mesh: MeshData, params: BinParams): number[] {
  const c = cavity(params);
  const r = params.interiorFilletMm ?? 0;
  const xs = [c.left + r / 4, c.left + c.innerW / 2 + 0.37, c.left + c.innerW - r / 4];
  return [3, 4, 6, 9].flatMap((dy) =>
    xs.map((x) => surfaceOverFloor(mesh, x, c.front + dy, c.floorTop))
  );
}

/**
 * How far the surface a quarter radius in from each side wall stands above the
 * ramp at mid-width, at `y`, the lower of the two: the fillet riding the ramp up
 * those walls, or nothing where the ramp meets them square.
 */
function rampSideRise(mesh: MeshData, params: BinParams, y: number): number {
  const c = cavity(params);
  const r = params.interiorFilletMm ?? 0;
  const mid = surfaceOverFloor(mesh, c.left + c.innerW / 2 + 0.37, y, c.floorTop);
  return Math.min(
    ...[c.left + r / 4, c.left + c.innerW - r / 4].map(
      (x) => surfaceOverFloor(mesh, x, y, c.floorTop) - mid
    )
  );
}

function expectRampClimbed(mesh: MeshData, params: BinParams, y = cavity(params).front + 4): void {
  const r = params.interiorFilletMm ?? 0;
  expect(rampSideRise(mesh, params, y)).toBeGreaterThan(quarterRise(r, r / 4) / 3);
}

function expectRampSquare(mesh: MeshData, params: BinParams, y: number): void {
  expect(rampSideRise(mesh, params, y)).toBeCloseTo(0, 1);
}

/** The front ramp's surface just off mid-width, every millimetre from the wall to past its foot. */
function frontRampMidline(mesh: MeshData, params: BinParams): number[] {
  const c = cavity(params);
  const x = c.left + c.innerW / 2 + 0.37;
  return Array.from({ length: 14 }, (_, i) =>
    surfaceOverFloor(mesh, x, c.front + 1.5 + i, c.floorTop)
  );
}

const FRONT_SCOOP = { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 'auto' as const };

/**
 * A 1x3 bin with the fillet the toggle sets, a front scoop and the cutouts the
 * toggle enables on the long walls. Neither cutout reaches the ramp.
 */
const CLEAR_SIDE_CUTOUTS: Partial<BinParams> = {
  width: 1,
  depth: 3,
  height: 3,
  interiorFilletMm: defaultInteriorFilletMm(DEFAULT_BIN_PARAMS.wallThickness),
  scoop: FRONT_SCOOP,
  walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
};

/** A front cutout that drops through the lip filler and the top of the ramp below it. */
const FRONT_CUTOUT: BinParams['walls'] = {
  ...DEFAULT_BIN_PARAMS.walls,
  enabled: true,
  left: DISABLED_WALL_CUTOUT,
  right: DISABLED_WALL_CUTOUT,
  front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 50, depth: 80 },
};

const CUTOUT_OVER_RAMP: Partial<BinParams> = {
  width: 2,
  depth: 1,
  height: 4,
  interiorFilletMm: 2.45,
  scoop: FRONT_SCOOP,
  walls: FRONT_CUTOUT,
};

const { interiorFilletMm: _radius, ...SHARP_CUTOUT_OVER_RAMP } = CUTOUT_OVER_RAMP;

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
  // The fillet's doorway trim reaches further in than the cutout does, so a
  // ramp the fillet carried would come out notched past the doorway. The scoop
  // keeps the ramp a cutout reaches, which the doorway then cuts as it cuts the
  // same bin without a fillet.
  defineScenario(
    'interior fillet #4382',
    'a cutout in the scooped wall keeps the scoop and the plain fillet apart',
    {
      assert: 'structural',
      forExport: true,
      params: CUTOUT_OVER_RAMP,
      compareWith: {
        params: SHARP_CUTOUT_OVER_RAMP,
        forExport: true,
        assert: (rounded, sharp) => {
          const params = { ...DEFAULT_BIN_PARAMS, ...CUTOUT_OVER_RAMP };
          const sharpLine = frontRampMidline(sharp, params);
          frontRampMidline(rounded, params).forEach((z, i) =>
            expect(z).toBeCloseTo(sharpLine[i], 1)
          );
          expectRampSquare(rounded, params, cavity(params).front + 6);
        },
      },
    }
  ),
  filletCase(
    'side cutouts clear of the ramp let the fillet climb it',
    {
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
    },
    (mesh, params) => expectRampClimbed(mesh, params)
  ),
  filletCase(
    'a cutout over one ramp leaves the opposite ramp climbed',
    {
      width: 2,
      depth: 2,
      height: 4,
      interiorFilletMm: 2.45,
      scoop: { ...FRONT_SCOOP, sides: ['front', 'back'] },
      walls: FRONT_CUTOUT,
    },
    (mesh, params) => {
      const c = cavity(params);
      expectRampClimbed(mesh, params, c.front + c.innerD - 4);
      expectRampSquare(mesh, params, c.front + 6);
    }
  ),
  filletCase(
    'a divider cutout keeps the ramp standing on it and lets the outer one climb',
    {
      width: 1,
      depth: 2,
      height: 4,
      interiorFilletMm: 2.45,
      scoop: FRONT_SCOOP,
      compartments: { cols: 1, rows: 2, cells: [0, 1], thickness: 1.2 },
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 80 },
      },
    },
    (mesh, params) => {
      expectRampClimbed(mesh, params);
      expectRampSquare(mesh, params, dividerFace(params) + 6);
    }
  ),
  filletCase(
    'side wall cutouts clear of the ramp leave it smooth and climbed',
    CLEAR_SIDE_CUTOUTS,
    (mesh, params) => {
      expectRampClimbed(mesh, params);
      expect(frontRampFacetLines(mesh, params)).toBe(0);
    }
  ),
  // Without a lip the ramp has no filler up the wall, and a rim fillet builds
  // the interior fillet into the shell instead of as a feature.
  filletCase(
    'side wall cutouts clear of a lipless ramp leave it climbed under a rim fillet',
    {
      ...CLEAR_SIDE_CUTOUTS,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false, rimFillet: true },
    },
    (mesh, params) => {
      expectRampClimbed(mesh, params);
      expect(frontRampFacetLines(mesh, params)).toBe(0);
    }
  ),
  defineScenario(
    'interior fillet #4382',
    'side wall cutouts clear of the ramp leave the scoop as it is without them',
    {
      assert: 'structural',
      forExport: true,
      params: CLEAR_SIDE_CUTOUTS,
      compareWith: {
        params: { ...CLEAR_SIDE_CUTOUTS, walls: DEFAULT_BIN_PARAMS.walls },
        forExport: true,
        assert: (cut, uncut) => {
          const params = { ...DEFAULT_BIN_PARAMS, ...CLEAR_SIDE_CUTOUTS };
          expect(frontRampFacetLines(cut, params)).toBe(frontRampFacetLines(uncut, params));
          const withCutouts = frontRampSection(cut, params);
          const without = frontRampSection(uncut, params);
          withCutouts.forEach((z, i) => expect(z).toBeCloseTo(without[i], 1));
        },
      },
    }
  ),
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
  filletCase(
    'a half-grid bin climbs its ramps like a whole one',
    {
      width: 1.5,
      depth: 2,
      height: 4,
      interiorFilletMm: 2.45,
      scoop: FRONT_SCOOP,
      compartments: { cols: 1, rows: 2, cells: [0, 1], thickness: 1.2 },
    },
    expectBothRowsRounded
  ),
  filletCase('a straight scoop on a tapered wall keeps the plain fillet', {
    width: 2,
    depth: 1,
    height: 4,
    interiorFilletMm: 2.45,
    scoop: { ...FRONT_SCOOP, style: 'straight' },
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
  // The scooped wall stands straight, but the compartment's side walls lean,
  // which the ramp's vertical air cannot follow.
  filletCase('a scoop beside tapered side walls keeps the plain fillet', {
    width: 2,
    depth: 1,
    height: 4,
    interiorFilletMm: 2.45,
    scoop: FRONT_SCOOP,
    overhang: {
      left: 3,
      right: 3,
      front: 0,
      back: 0,
      feet: false,
      taper: {
        enabled: true,
        profile: 'chamfer',
        bandHeight: 6,
        left: 3,
        right: 3,
        front: 0,
        back: 0,
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
