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
      assert: (noDivider, withDivider) => {
        // Junction blocking: the divider should not dramatically change the
        // triangle count in either direction. The multi-cavity cut shell
        // path (#1753) gives compartment cavities sharp inner corners where
        // the single-cavity hollow had rounded ones, which shifts the
        // triangle delta a few percent up at thick wallThickness. A real
        // junction-clip failure adds hundreds of hex prism triangles (>>10%)
        // so the loosened bound still catches the regression this test
        // exists for. The lower bound (>= 1) catches a divider-regression
        // where compartments collapse to a no-op (delta would be 0).
        const delta = Math.abs(withDivider.triangleCount - noDivider.triangleCount);
        const maxDelta = noDivider.triangleCount * 0.1;
        expect(
          delta,
          'divider produced identical geometry — divider path may have regressed'
        ).toBeGreaterThan(0);
        expect(
          delta,
          `divider changed triangle count by ${delta} (max ${Math.round(maxDelta)}); junction clip depth may be too shallow`
        ).toBeLessThanOrEqual(maxDelta);
      },
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
      assert: (noDivider, withDivider) => {
        // Junction blocking: the divider should not dramatically change the
        // triangle count in either direction. The multi-cavity cut shell
        // path (#1753) gives compartment cavities sharp inner corners where
        // the single-cavity hollow had rounded ones, which shifts the
        // triangle delta a few percent up at thick wallThickness. A real
        // junction-clip failure adds hundreds of hex prism triangles (>>10%)
        // so the loosened bound still catches the regression this test
        // exists for. The lower bound (>= 1) catches a divider-regression
        // where compartments collapse to a no-op (delta would be 0).
        const delta = Math.abs(withDivider.triangleCount - noDivider.triangleCount);
        const maxDelta = noDivider.triangleCount * 0.1;
        expect(
          delta,
          'divider produced identical geometry — divider path may have regressed'
        ).toBeGreaterThan(0);
        expect(
          delta,
          `divider changed triangle count by ${delta} (max ${Math.round(maxDelta)}); junction clip depth may be too shallow`
        ).toBeLessThanOrEqual(maxDelta);
      },
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
        assert: (noDivider, withDivider) => {
          // Junction blocking: the divider should not cause a dramatic
          // triangle count change in either direction. Without blocking, hex
          // cuts through the junction would add hundreds of extra triangles;
          // with the multi-cavity cut shell path the divider is cut residue
          // and can slightly *reduce* total triangles. Either way, the delta
          // should stay within 5%. The lower bound (>= 1) catches a
          // divider-regression where compartments collapse to a no-op.
          const delta = Math.abs(withDivider.triangleCount - noDivider.triangleCount);
          const maxDelta = noDivider.triangleCount * 0.05;
          expect(
            delta,
            'divider produced identical geometry — divider path may have regressed'
          ).toBeGreaterThan(0);
          expect(
            delta,
            `divider changed triangle count by ${delta} (max ${Math.round(maxDelta)}); junction blocking may be broken`
          ).toBeLessThanOrEqual(maxDelta);
        },
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
