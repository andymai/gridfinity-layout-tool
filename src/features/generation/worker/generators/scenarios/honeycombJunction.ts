/**
 * Honeycomb wall pattern + divider junction regression scenarios (#1350).
 *
 * These pin triangle counts for configurations where the honeycomb pattern
 * interacts with divider walls at the outer-wall junction. Regressions in
 * junction blocking (e.g. hex prisms cutting through dividers) change the
 * triangle count because extra cut faces appear or solid wall geometry is
 * removed.
 */
import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import type { MeshData } from '@/features/generation/bridge/types';

/** Enclosed (solid) volume of a triangle mesh via the signed-tetrahedron sum. */
function meshVolume({ vertices, indices }: MeshData): number {
  let v = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = (indices[i] ?? 0) * 3;
    const b = (indices[i + 1] ?? 0) * 3;
    const c = (indices[i + 2] ?? 0) * 3;
    const ax = vertices[a] ?? 0,
      ay = vertices[a + 1] ?? 0,
      az = vertices[a + 2] ?? 0;
    const bx = vertices[b] ?? 0,
      by = vertices[b + 1] ?? 0,
      bz = vertices[b + 2] ?? 0;
    const cx = vertices[c] ?? 0,
      cy = vertices[c + 1] ?? 0,
      cz = vertices[c + 2] ?? 0;
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return Math.abs(v) / 6;
}

/**
 * Assert a compartment divider both exists and didn't break junction blocking.
 *
 * occt-wasm geometry is not bit-reproducible across CPUs (relaxed FMA rounds
 * differently per microarchitecture), so exact triangle-count deltas flake
 * across machines — the same divider can net +232 triangles on one CPU and a
 * coincidental 0 on another. So: use *volume* (robust to tessellation) to prove
 * the divider physically exists, and a generous triangle bound to catch only a
 * real junction-clip failure, which floods the junction with hundreds of escaped
 * hex-prism faces (≫ the few-percent cross-CPU tessellation variance).
 */
function assertDividerJunction(noDivider: MeshData, withDivider: MeshData): void {
  const baseVolume = meshVolume(noDivider);
  const volumeDelta = Math.abs(meshVolume(withDivider) - baseVolume);
  expect(
    volumeDelta,
    'divider produced no volume change — divider path may have regressed'
  ).toBeGreaterThan(baseVolume * 0.005);

  const triangleDelta = Math.abs(withDivider.triangleCount - noDivider.triangleCount);
  const maxTriangleDelta = noDivider.triangleCount * 0.3;
  expect(
    triangleDelta,
    `divider changed triangle count by ${triangleDelta} (max ${Math.round(maxTriangleDelta)}); junction blocking may be broken`
  ).toBeLessThanOrEqual(maxTriangleDelta);
}

/** All cutout sides explicitly disabled — used as the canonical "no cutouts" walls config. */
const ALL_SIDES_OFF = {
  ...DEFAULT_BIN_PARAMS.walls,
  enabled: false,
  front: DISABLED_WALL_CUTOUT,
  back: DISABLED_WALL_CUTOUT,
  left: DISABLED_WALL_CUTOUT,
  right: DISABLED_WALL_CUTOUT,
  interior: DISABLED_WALL_CUTOUT,
} as const;

export const honeycombJunction: ScenarioCase[] = [
  // ── Baseline: honeycomb without dividers ─────────────────────────────────

  defineScenario('honeycomb junction', '2×2×4 honeycomb baseline (no dividers)', {
    params: {
      width: 2,
      depth: 2,
      height: 4,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      walls: ALL_SIDES_OFF,
    },
    timeout: 60_000,
  }),

  // ── Bug 1: junction blocking must work without wall cutouts ──────────────

  defineScenario('honeycomb junction', '2×2 bin, 2×1 compartments, no cutouts', {
    params: {
      width: 2,
      depth: 2,
      height: 4,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
      walls: ALL_SIDES_OFF,
    },
    timeout: 60_000,
  }),

  defineScenario('honeycomb junction', '2×2 bin, 2×2 compartments, no cutouts', {
    params: {
      width: 2,
      depth: 2,
      height: 4,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
      walls: ALL_SIDES_OFF,
    },
    timeout: 60_000,
  }),

  // ── Bug 2: no mesh holes when cutouts enabled but all sides off ──────────

  defineScenario('honeycomb junction', '2×2 bin, 2×1 compartments, cutouts on (sides off)', {
    params: {
      width: 2,
      depth: 2,
      height: 4,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
      walls: { ...ALL_SIDES_OFF, enabled: true },
    },
    timeout: 60_000,
  }),

  // ── Junction + active cutout on one side ─────────────────────────────────

  defineScenario('honeycomb junction', '2×2 bin, 2×1 compartments + front cutout', {
    params: {
      width: 2,
      depth: 2,
      height: 4,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
      walls: {
        ...ALL_SIDES_OFF,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      },
    },
    timeout: 60_000,
  }),

  // ── Honeycomb + dividers + interior wall cutouts ──────────────────────────

  defineScenario('honeycomb junction', '2×2 bin, 2×2 compartments + interior cutouts', {
    params: {
      width: 2,
      depth: 2,
      height: 4,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
      walls: {
        ...ALL_SIDES_OFF,
        enabled: true,
        interior: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      },
    },
    timeout: 60_000,
  }),

  // ── Honeycomb + dividers + outer + interior cutouts ──────────────────────

  defineScenario('honeycomb junction', '2×2 bin, 2×1 compartments + front + interior cutouts', {
    params: {
      width: 2,
      depth: 2,
      height: 4,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
      walls: {
        ...ALL_SIDES_OFF,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        interior: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      },
    },
    timeout: 60_000,
  }),

  // ── Bug 3: clip depth must cover hex prism extrusion at thick walls (#1354) ─
  // When wallThickness > 0.85mm (especially without lip), cutDepth = wallThickness*4
  // can exceed clipExtrudeDepth, letting hex prisms escape junction clip boxes.

  defineScenario('honeycomb junction', 'thick walls (1.6mm) no lip — junction blocking holds', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      wallThickness: 1.6,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      walls: ALL_SIDES_OFF,
    },
    compareWith: {
      params: {
        width: 2,
        depth: 2,
        height: 4,
        wallThickness: 1.6,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        wallPattern: { enabled: true, pattern: 'honeycomb' },
        compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
        walls: ALL_SIDES_OFF,
      },
      assert: assertDividerJunction,
    },
    timeout: 60_000,
  }),

  defineScenario('honeycomb junction', 'thick walls (2.4mm) no lip — junction blocking holds', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      wallThickness: 2.4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      walls: ALL_SIDES_OFF,
    },
    compareWith: {
      params: {
        width: 2,
        depth: 2,
        height: 4,
        wallThickness: 2.4,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        wallPattern: { enabled: true, pattern: 'honeycomb' },
        compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
        walls: ALL_SIDES_OFF,
      },
      assert: assertDividerJunction,
    },
    timeout: 60_000,
  }),

  // ── Dividers add geometry but junction blocking limits the increase ─────
  // Adding a divider adds wall geometry but removes hex prisms at the
  // junction. Net result: slightly more triangles, not dramatically more.

  defineScenario(
    'honeycomb junction',
    'adding divider increases triangles modestly (junction blocking works)',
    {
      assert: 'structural',
      params: {
        width: 2,
        depth: 2,
        height: 4,
        wallPattern: { enabled: true, pattern: 'honeycomb' },
        walls: ALL_SIDES_OFF,
      },
      compareWith: {
        params: {
          width: 2,
          depth: 2,
          height: 4,
          wallPattern: { enabled: true, pattern: 'honeycomb' },
          compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
          walls: ALL_SIDES_OFF,
        },
        assert: assertDividerJunction,
      },
      timeout: 60_000,
    }
  ),

  // ── Triangle count must match regardless of cutout toggle ────────────────
  // Both configs have all sides explicitly DISABLED_WALL_CUTOUT; the only
  // difference is walls.enabled (false vs true). Triangle counts must match.

  defineScenario(
    'honeycomb junction',
    'cutout toggle off vs on (sides off) produces same triangle count',
    {
      assert: 'structural',
      params: {
        width: 2,
        depth: 2,
        height: 4,
        wallPattern: { enabled: true, pattern: 'honeycomb' },
        compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
        walls: ALL_SIDES_OFF,
      },
      compareWith: {
        params: {
          width: 2,
          depth: 2,
          height: 4,
          wallPattern: { enabled: true, pattern: 'honeycomb' },
          compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
          walls: { ...ALL_SIDES_OFF, enabled: true },
        },
        assert: (cutoutsOff, cutoutsOnSidesOff) => {
          expect(
            cutoutsOff.triangleCount,
            'triangle count must match regardless of walls.enabled when no sides are active'
          ).toBe(cutoutsOnSidesOff.triangleCount);
        },
      },
      timeout: 60_000,
    }
  ),
];
