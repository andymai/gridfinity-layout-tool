/**
 * Interior fillet carried up finger scoops (#4382): where a ramp meets an
 * unscooped side wall, the floor fillet runs on up the ramp and the corner
 * above it. Built on the plain fillet's cases and probes.
 */
import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { TWO_BY_TWO, cavity, filletCase, floorSurfaceAt, quarterRise } from './interiorFillet';

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
