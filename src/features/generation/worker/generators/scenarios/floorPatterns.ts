/**
 * Floor pattern scenarios.
 *
 * These pin the promise the feature makes: the holes go all the way THROUGH —
 * floor slab and base socket both — while the socket's baseplate-mating taper
 * comes out untouched. The export-integrity matrix picks these up too, so a
 * pattern that left the fused solid non-watertight fails there.
 */
import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import { meshVolume } from '../__kernel-tests__/meshAssertions';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import type { MeshData } from '@/features/generation/bridge/types';
import type { BinParams, CompartmentConfig } from '@/shared/types/bin';
import { CLEARANCE, INSET_BOT } from '../generatorConstants';

/** Tolerance for "on the foot underside plane" (Z = 0 after the socket lift). */
const BOTTOM_EPS = 0.01;

/** Vertices lying on the foot underside plane. */
function bottomVertexCount({ vertices }: MeshData): number {
  let n = 0;
  for (let i = 2; i < vertices.length; i += 3) {
    if (Math.abs(vertices[i] ?? 0) < BOTTOM_EPS) n++;
  }
  return n;
}

/** X/Y extent of the geometry on the foot underside plane. */
function footprintOnBottom({ vertices }: MeshData): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    if (Math.abs(vertices[i + 2] ?? 0) >= BOTTOM_EPS) continue;
    const x = vertices[i] ?? 0;
    const y = vertices[i + 1] ?? 0;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minX, maxX, minY, maxY };
}

/**
 * The load-bearing invariant: the outline of the foot underside is exactly the
 * nominal one. A hole that wandered past the window inset would exit through
 * the tapered flank instead, notching the surface the baseplate mates against.
 */
function assertFeetUnbreached(result: MeshData, params: BinParams): void {
  const half = (units: number, pitch: number): number =>
    (units * pitch) / 2 - CLEARANCE / 2 - INSET_BOT;
  const expected = {
    x: half(params.width, params.gridUnitMm),
    y: half(params.depth, params.gridUnitMmY ?? params.gridUnitMm),
  };
  const box = footprintOnBottom(result);
  expect(box.maxX, 'a floor hole broke out through the foot taper (+X)').toBeCloseTo(expected.x, 2);
  expect(box.minX, 'a floor hole broke out through the foot taper (-X)').toBeCloseTo(
    -expected.x,
    2
  );
  expect(box.maxY, 'a floor hole broke out through the foot taper (+Y)').toBeCloseTo(expected.y, 2);
  expect(box.minY, 'a floor hole broke out through the foot taper (-Y)').toBeCloseTo(
    -expected.y,
    2
  );
}

/**
 * Assert the pattern reached all the way through: material removed, and new
 * rims on the foot underside (a floor-only cut would leave that plane alone).
 * `solid` is the pattern-off mesh, `drained` the pattern-on one.
 */
function assertDrainsThrough(drained: MeshData, solid: MeshData): void {
  expect(
    meshVolume(drained),
    'floor pattern removed no material — the panels never reached the boolean'
  ).toBeLessThan(meshVolume(solid));
  expect(
    bottomVertexCount(drained),
    'floor pattern left the foot underside untouched — the holes end in a blind pocket'
  ).toBeGreaterThan(bottomVertexCount(solid));
}

const TWO_BY_TWO: CompartmentConfig = { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 };

const ROUND_FLOOR = { enabled: true, pattern: 'round', scale: 0.5 } as const;
const HONEYCOMB_FLOOR = { enabled: true, pattern: 'honeycomb', scale: 0.5 } as const;

export const floorPatterns: ScenarioCase[] = [
  // ── The core promise: the holes drain ─────────────────────────────────────

  defineScenario('floor patterns', 'round holes drain through floor and socket', {
    assert: 'structural',
    params: { width: 2, depth: 1, height: 4 },
    compareWith: {
      params: { width: 2, depth: 1, height: 4, floorPattern: ROUND_FLOOR },
      // `compareWith` hands the scenario mesh first, so the plain bin is the
      // first argument here and the drained one the second.
      assert: (plain, drained) => {
        assertDrainsThrough(drained, plain);
      },
    },
    timeout: 90_000,
  }),

  defineScenario('floor patterns', 'holes stay clear of the baseplate-mating taper', {
    assert: 'structural',
    params: { width: 2, depth: 2, height: 4, floorPattern: HONEYCOMB_FLOOR },
    customAssert: assertFeetUnbreached,
    timeout: 90_000,
  }),

  // ── Everything that already occupies the base or stands on the floor ──────

  defineScenario('floor patterns', 'magnet + screw pockets stay solid', {
    params: {
      width: 2,
      depth: 2,
      height: 4,
      floorPattern: ROUND_FLOOR,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw' },
    },
    customAssert: assertFeetUnbreached,
    timeout: 90_000,
  }),

  defineScenario('floor patterns', 'compartment divider footings stay solid', {
    params: {
      width: 2,
      depth: 2,
      height: 4,
      floorPattern: HONEYCOMB_FLOOR,
      compartments: TWO_BY_TWO,
    },
    timeout: 90_000,
  }),

  defineScenario('floor patterns', 'scoop ramp footings stay solid', {
    params: {
      width: 2,
      depth: 2,
      height: 5,
      floorPattern: ROUND_FLOOR,
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
    },
    timeout: 90_000,
  }),

  // ── Base variants ────────────────────────────────────────────────────────

  defineScenario('floor patterns', 'flat base takes one interior-wide window', {
    params: {
      width: 2,
      depth: 1,
      height: 4,
      floorPattern: ROUND_FLOOR,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
    },
    timeout: 90_000,
  }),

  defineScenario('floor patterns', 'half sockets get one window per quarter foot', {
    params: {
      width: 1,
      depth: 1,
      height: 4,
      floorPattern: ROUND_FLOOR,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    },
    timeout: 90_000,
  }),

  defineScenario('floor patterns', 'fractional edge foot carries a narrower window', {
    params: { width: 1.5, depth: 1, height: 4, floorPattern: ROUND_FLOOR },
    timeout: 90_000,
  }),

  // ── Composition ──────────────────────────────────────────────────────────

  defineScenario('floor patterns', 'floor and wall patterns compose', {
    params: {
      width: 2,
      depth: 2,
      height: 5,
      floorPattern: HONEYCOMB_FLOOR,
      wallPattern: { enabled: true, pattern: 'honeycomb', scale: 0.5, dividers: false },
    },
    timeout: 120_000,
  }),

  defineScenario('floor patterns', 'custom-shape bin patterns only its filled feet', {
    params: {
      width: 2,
      depth: 2,
      height: 4,
      floorPattern: ROUND_FLOOR,
      cellMask: { cols: 4, rows: 4, cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0] },
    },
    timeout: 90_000,
  }),

  // ── Degenerate: an element too bold for any window leaves the floor solid ─

  defineScenario('floor patterns', 'oversized elements leave the floor solid', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 10,
      floorPattern: { enabled: true, pattern: 'honeycomb', scale: 1 },
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
      wallThickness: 4,
    },
    compareWith: {
      params: {
        width: 1,
        depth: 1,
        height: 10,
        base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
        wallThickness: 4,
      },
      // Identical to the un-patterned bin: a window too small for one element
      // must leave the floor solid, not emit a sliver.
      assert: (oversized, plain) => {
        expect(meshVolume(oversized)).toBeCloseTo(meshVolume(plain), 3);
      },
    },
    timeout: 90_000,
  }),
];
