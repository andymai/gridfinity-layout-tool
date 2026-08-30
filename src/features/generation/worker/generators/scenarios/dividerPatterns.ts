/**
 * Divider wall pattern scenarios.
 *
 * These pin the behaviour of carrying the outer wall pattern through the
 * compartment dividers: that it removes material, that it composes with every
 * feature that intrudes on a divider (scoops, interior cutouts, label tabs,
 * crossings), and that both pattern pipelines — stamp and kumiko — survive it.
 */
import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import { meshVolume } from '../__kernel-tests__/meshAssertions';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import type { MeshData } from '@/features/generation/bridge/types';
import type { CompartmentConfig } from '@/shared/types/bin';

/**
 * Assert the divider option actually perforated the dividers.
 *
 * Volume rather than triangle count: occt-wasm tessellation is not
 * bit-reproducible across CPUs, but removed material is. `solid` is the
 * dividers-off mesh, `patterned` the dividers-on one.
 */
function assertDividersPerforated(solid: MeshData, patterned: MeshData): void {
  const solidVolume = meshVolume(solid);
  const patternedVolume = meshVolume(patterned);
  expect(
    patternedVolume,
    'divider pattern removed no material — the panels never reached the boolean'
  ).toBeLessThan(solidVolume);
  // Guard the other direction too: a runaway cut prism (one that reaches past
  // its own divider) would remove far more than a divider's worth of material.
  expect(
    solidVolume - patternedVolume,
    'divider pattern removed an implausible amount of material'
  ).toBeLessThan(solidVolume * 0.25);
}

/** All cutout sides explicitly disabled. */
const ALL_SIDES_OFF = {
  ...DEFAULT_BIN_PARAMS.walls,
  enabled: false,
  front: DISABLED_WALL_CUTOUT,
  back: DISABLED_WALL_CUTOUT,
  left: DISABLED_WALL_CUTOUT,
  right: DISABLED_WALL_CUTOUT,
  interior: DISABLED_WALL_CUTOUT,
} as const;

const TWO_BY_TWO: CompartmentConfig = { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 };

export const dividerPatterns: ScenarioCase[] = [
  // ── The core promise: dividers carry the pattern ──────────────────────────

  defineScenario('divider patterns', 'honeycomb dividers perforate the compartment walls', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: false },
      compartments: TWO_BY_TWO,
      walls: ALL_SIDES_OFF,
    },
    compareWith: {
      params: {
        width: 2,
        depth: 2,
        height: 6,
        wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
        compartments: TWO_BY_TWO,
        walls: ALL_SIDES_OFF,
      },
      assert: assertDividersPerforated,
    },
  }),

  defineScenario('divider patterns', '2×2 honeycomb dividers', {
    params: {
      width: 2,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
      compartments: TWO_BY_TWO,
      walls: ALL_SIDES_OFF,
    },
  }),

  defineScenario('divider patterns', 'round pattern on a single column divider', {
    params: {
      width: 3,
      depth: 1,
      height: 6,
      wallPattern: { enabled: true, pattern: 'round', dividers: true },
      compartments: { cols: 3, rows: 1, cells: [0, 1, 2], thickness: 1.2 },
      walls: ALL_SIDES_OFF,
    },
  }),

  // ── Feature keep-outs — every intruder that lands on a divider ────────────

  defineScenario('divider patterns', 'dividers + scoops keep the ramp footings solid', {
    params: {
      width: 2,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
      compartments: TWO_BY_TWO,
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
      walls: ALL_SIDES_OFF,
    },
  }),

  defineScenario('divider patterns', 'dividers + interior cutouts', {
    params: {
      width: 2,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
      compartments: TWO_BY_TWO,
      walls: {
        ...ALL_SIDES_OFF,
        enabled: true,
        interior: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      },
    },
  }),

  defineScenario('divider patterns', 'dividers + label tabs keep the shelf anchorage solid', {
    params: {
      width: 2,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
      compartments: TWO_BY_TWO,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      walls: ALL_SIDES_OFF,
    },
  }),

  defineScenario('divider patterns', 'dividers + outer cutouts + handles', {
    params: {
      width: 3,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
      compartments: TWO_BY_TWO,
      walls: {
        ...ALL_SIDES_OFF,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 60, depth: 40 },
      },
    },
  }),

  // ── Divider geometry variants ────────────────────────────────────────────

  // `dividerHeight` is in mm: a 6u bin has ~36.5mm of interior, so 20mm is a
  // genuinely shortened divider and 4mm leaves no band at all once the top
  // keep-out and floor skirt are taken out.
  defineScenario('divider patterns', 'shortened dividers re-fit the band', {
    params: {
      width: 2,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
      compartments: { ...TWO_BY_TWO, dividerHeight: 20 },
      walls: ALL_SIDES_OFF,
    },
  }),

  defineScenario('divider patterns', 'divider too short for a band stays solid', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: false },
      compartments: { ...TWO_BY_TWO, dividerHeight: 4 },
      walls: ALL_SIDES_OFF,
    },
    compareWith: {
      params: {
        width: 2,
        depth: 2,
        height: 6,
        wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
        compartments: { ...TWO_BY_TWO, dividerHeight: 4 },
        walls: ALL_SIDES_OFF,
      },
      assert: (off, on) => {
        expect(on.triangleCount, 'a divider with no room for a band must be left untouched').toBe(
          off.triangleCount
        );
      },
    },
  }),

  defineScenario('divider patterns', 'tilted dividers carry the pattern in-plane', {
    params: {
      width: 2,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
      compartments: {
        cols: 2,
        rows: 1,
        cells: [0, 1],
        thickness: 1.2,
        dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: -6, offsetEnd: 6 }],
      },
      walls: ALL_SIDES_OFF,
    },
  }),

  // Angle AND Lean on the same divider. The foot line is the top line
  // translated by the whole drift; keeping only its across-run component
  // sheared the foot off its run and out of the bin. Exercises the full
  // pipeline + export integrity (watertight / manifold) for the compound case.
  defineScenario('divider patterns', 'compound angled + leaned divider stays inside the bin', {
    params: {
      width: 2,
      depth: 2,
      height: 6,
      compartments: {
        cols: 2,
        rows: 1,
        cells: [0, 1],
        thickness: 1.2,
        dividerOverrides: [
          { compartmentA: 0, compartmentB: 1, offsetStart: -6, offsetEnd: 6, rakeDeg: 25 },
        ],
      },
      walls: ALL_SIDES_OFF,
    },
  }),

  defineScenario('divider patterns', 'half-grid footprint with patterned dividers', {
    params: {
      width: 2.5,
      depth: 1.5,
      height: 6,
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
      walls: ALL_SIDES_OFF,
    },
  }),

  defineScenario('divider patterns', 'overhang shifts the interior with the dividers', {
    params: {
      width: 2,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
      compartments: TWO_BY_TWO,
      overhang: { enabled: true, left: 4, right: 0, front: 2, back: 0, feet: false },
      walls: ALL_SIDES_OFF,
    },
  }),

  // ── Kumiko lattice panels on dividers ────────────────────────────────────

  defineScenario('divider patterns', 'mitsukude lattice on dividers', {
    params: {
      width: 2,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'mitsukude', dividers: true },
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
      walls: ALL_SIDES_OFF,
    },
    timeout: 180_000,
  }),

  defineScenario('divider patterns', 'kumiko dividers perforate the compartment walls', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'mitsukude', dividers: false },
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
      walls: ALL_SIDES_OFF,
    },
    compareWith: {
      params: {
        width: 2,
        depth: 2,
        height: 6,
        wallPattern: { enabled: true, pattern: 'mitsukude', dividers: true },
        compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
        walls: ALL_SIDES_OFF,
      },
      assert: assertDividersPerforated,
    },
    timeout: 180_000,
  }),

  // ── Non-applicable configurations must be inert ──────────────────────────

  defineScenario('divider patterns', 'single compartment is unaffected by the divider option', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: false },
      walls: ALL_SIDES_OFF,
    },
    compareWith: {
      params: {
        width: 2,
        depth: 2,
        height: 6,
        wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
        walls: ALL_SIDES_OFF,
      },
      assert: (off, on) => {
        expect(
          on.triangleCount,
          'a bin with no dividers must be byte-identical with the option on'
        ).toBe(off.triangleCount);
      },
    },
  }),
];
